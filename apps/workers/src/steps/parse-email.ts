/**
 * Step: Parse Email
 * Equivalent N8N: "Start + Download" + "Premier filtre"
 *
 * 1. Reformats the Unipile webhook payload
 * 2. Downloads all valid attachments
 * 3. Detects content types (PDF, Excel, Notion, GDrive, DocSend, etc.)
 */

import { downloadAttachment, fetchEmailDetail, fetchThread, type UnipileAttachment, type UnipileEmail } from "../lib/unipile";

// --- Types ---

export interface ParsedAttachment {
  id: string;
  name: string;
  extension: string;
  mime: string;
  size: number;
  buffer: Buffer;
}

export interface InlineImage {
  id: string;
  cid: string;
  name: string;
  extension: string;
  mime: string;
  size: number;
  buffer: Buffer;
}

export type RouteType = "pdf" | "excel" | "notion" | "google_drive" | "docsend" | "text_only";

export interface ParsedEmail {
  emailId: string;
  accountId: string;
  threadId: string;
  messageId: string;
  providerId: string;
  subject: string;
  date: string;
  bodyText: string;
  bodyHtml: string;
  from: { address: string; name: string };
  to: { address: string; name: string }[];
  cc: { address: string; name: string }[];
  attachments: ParsedAttachment[];
  inlineImages: InlineImage[];
  routes: RouteType[];
  notionLinks: string[];
  googleDriveLinks: { url: string; fileId: string }[];
  docSendLinks: string[];
}

// --- Link extraction ---

function extractNotionLinks(content: string): string[] {
  const seen = new Set<string>();
  const patterns = [
    /https?:\/\/(www\.)?notion\.so\/[^\s<")']+/gi,
    /https?:\/\/[a-zA-Z0-9-]+\.notion\.site\/[^\s<")']+/gi,
  ];
  for (const rx of patterns) {
    let m;
    while ((m = rx.exec(content)) !== null) {
      seen.add(m[0].replace(/[<>"')]+$/, ""));
    }
  }
  const hrefRx = /href=["']([^"']*notion\.(so|site)[^"']*)["']/gi;
  let hm;
  while ((hm = hrefRx.exec(content)) !== null) {
    seen.add(hm[1]);
  }
  return [...seen];
}

function extractGoogleDriveLinks(content: string): { url: string; fileId: string }[] {
  const seen = new Map<string, string>();
  const patterns: { rx: RegExp; grp: number }[] = [
    { rx: /https?:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)[^\s<")'"]*/gi, grp: 1 },
    { rx: /https?:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/gi, grp: 1 },
    { rx: /https?:\/\/docs\.google\.com\/(?:document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)[^\s<")'"]*/gi, grp: 1 },
  ];
  for (const p of patterns) {
    let m;
    while ((m = p.rx.exec(content)) !== null) {
      const fileId = m[p.grp];
      if (!seen.has(fileId)) seen.set(fileId, m[0].replace(/[<>"')]+$/, ""));
    }
  }
  return [...seen].map(([fileId, url]) => ({ url, fileId }));
}

function extractDocSendLinks(content: string): string[] {
  const seen = new Set<string>();
  const patterns = [
    /https?:\/\/(www\.)?docsend\.com\/(view|v)\/[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*/gi,
    /https?:\/\/(www\.)?docsend\.com\/d\/[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*/gi,
    // Subdomain pattern (e.g. company.docsend.com/view/CODE)
    /https?:\/\/[a-zA-Z0-9-]+\.docsend\.com\/view\/[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*/gi,
  ];
  for (const rx of patterns) {
    let m;
    while ((m = rx.exec(content)) !== null) {
      seen.add(m[0]);
    }
  }
  // Also check href attributes containing docsend (like deck pipeline)
  const hrefRx = /href=["']([^"']*docsend[^"']*)["']/gi;
  let hm;
  while ((hm = hrefRx.exec(content)) !== null) {
    seen.add(hm[1]);
  }
  return [...seen];
}

// --- Tracking URL resolution ---
// Email tracking services wrap real links in redirects (SendGrid, Mailchimp, etc.)
// We follow redirects to uncover hidden DocSend/GDrive/Notion links.

const TRACKING_URL_PATTERNS = [
  /\.ct\.sendgrid\.net\/ls\/click/i,
  /list-manage\.com\/track\/click/i,
  /click\.mailchimp\.com/i,
  /hubspotemail\.net/i,
  /sendinblue\.com\/track/i,
  /mandrillapp\.com\/track/i,
  /tracking\.sendbim\.com/i,
];

function isTrackingUrl(url: string): boolean {
  return TRACKING_URL_PATTERNS.some((rx) => rx.test(url));
}

function extractAllHrefUrls(html: string): string[] {
  const urls = new Set<string>();
  const hrefRx = /href=["']([^"']+)["']/gi;
  let m;
  while ((m = hrefRx.exec(html)) !== null) {
    if (m[1].startsWith("http")) urls.add(m[1]);
  }
  return [...urls];
}

async function resolveTrackingUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AlboteBot/1.0)" },
    });
    clearTimeout(timeout);
    const finalUrl = response.url;
    return finalUrl !== url ? finalUrl : null;
  } catch {
    return null;
  }
}

// --- Attachment filtering ---

function isValidAttachment(att: UnipileAttachment): boolean {
  if (att.cid && (att.mime || "").startsWith("image/")) return false;
  return true;
}

// --- Main ---

export async function parseEmail(webhookPayload: Record<string, unknown>): Promise<ParsedEmail> {
  // Handle both direct payload and { event, data } format
  let emailData: Record<string, unknown> = webhookPayload;
  if (webhookPayload.event && webhookPayload.data) {
    emailData = webhookPayload.data as Record<string, unknown>;
  }

  const emailId = String(emailData.email_id || emailData.id || "");
  const accountId = String(emailData.account_id || "");

  // Si le payload est minimal (juste email_id + account_id), fetch l'email complet depuis Unipile
  const hasBody = emailData.body || emailData.body_plain || emailData.from_attendee;
  if (!hasBody && emailId) {
    console.log(`[parse-email] Payload minimal détecté — fetch email complet via API`);
    const fullEmail = await fetchEmailDetail(emailId);
    if (fullEmail) {
      // Injecter les champs manquants dans emailData
      for (const [key, value] of Object.entries(fullEmail)) {
        if (value !== undefined && value !== null && !(key in emailData)) {
          emailData[key] = value;
        }
      }
      console.log(`[parse-email] Email enrichi: from=${(fullEmail as any).from_attendee?.identifier || "?"}, body=${((fullEmail as any).body_plain || "").length} chars`);
    }
  }

  const fromAttendee = (emailData.from_attendee || {}) as Record<string, string>;
  const toAttendees = (emailData.to_attendees || []) as Record<string, string>[];
  const ccAttendees = (emailData.cc_attendees || []) as Record<string, string>[];

  const providerId = String(emailData.provider_id || "");
  const threadId = String(emailData.thread_id || "");
  let bodyText = String(emailData.body_plain || "");
  let bodyHtml = String(emailData.body || "");

  // Détection de body tronqué : le webhook Unipile ne livre parfois que le wrapper
  // de forwarding Gmail sans le contenu réel du forwarded message.
  // Le webhook envoie un body tronqué, mais l'API GET /emails/{id} retourne le body complet.
  const isForwarded = /fwd:|forwarded message/i.test(bodyText + bodyHtml);
  const isBodyTruncated = bodyText.length < 200;
  if (isForwarded && isBodyTruncated && emailId) {
    console.log(`[parse-email] Body tronqué détecté (${bodyText.length} chars, forwarded) — fetch email complet via API`);

    // Option 1 : fetch l'email directement — l'API retourne le body complet
    const fullEmail = await fetchEmailDetail(emailId);
    if (fullEmail && (fullEmail.body_plain || "").length > bodyText.length) {
      bodyText = fullEmail.body_plain || bodyText;
      bodyHtml = fullEmail.body || bodyHtml;
      console.log(`[parse-email] Email enrichi via API: body_plain=${bodyText.length} chars, body_html=${bodyHtml.length} chars`);
    }
    // Option 2 fallback : fetch le thread complet si l'email direct n'a pas plus de contenu
    else if (threadId && accountId) {
      console.log(`[parse-email] API email identique — fallback fetch thread ${threadId}`);
      const threadEmails = await fetchThread(accountId, threadId);
      const otherEmails = threadEmails.filter((e) => e.id !== emailId);
      if (otherEmails.length > 0) {
        const threadBodyParts = otherEmails.map((e) => e.body_plain || "").filter(Boolean);
        const threadHtmlParts = otherEmails.map((e) => e.body || "").filter(Boolean);
        if (threadBodyParts.length > 0) {
          bodyText = bodyText + "\n\n" + threadBodyParts.join("\n\n---\n\n");
        }
        if (threadHtmlParts.length > 0) {
          bodyHtml = bodyHtml + threadHtmlParts.join("");
        }
        console.log(`[parse-email] Thread enrichi: +${otherEmails.length} messages, body_plain=${bodyText.length} chars`);
      }
    }
  }

  const fullContent = bodyText + " " + bodyHtml;

  // Download attachments + inline images
  // Pass accountId + providerId for reliable access (required by Unipile for Gmail)
  const allAttachments = (emailData.attachments || []) as UnipileAttachment[];
  const regularAttachments = allAttachments.filter(isValidAttachment);
  const inlineAttachments = allAttachments.filter(
    (att) => att.cid && (att.mime || "").startsWith("image/")
  );

  const attachments: ParsedAttachment[] = [];
  for (const att of regularAttachments) {
    const result = await downloadAttachment(emailId, att.id, accountId, providerId);
    if (result) {
      attachments.push({
        id: att.id,
        name: att.name || `attachment.${att.extension || "bin"}`,
        extension: (att.extension || "").toLowerCase(),
        mime: att.mime || result.contentType,
        size: result.data.length,
        buffer: result.data,
      });
    }
  }

  const inlineImages: InlineImage[] = [];
  for (const att of inlineAttachments) {
    const result = await downloadAttachment(emailId, att.id, accountId, providerId);
    if (result) {
      inlineImages.push({
        id: att.id,
        cid: att.cid!,
        name: att.name || `inline.${att.extension || "jpg"}`,
        extension: (att.extension || "").toLowerCase(),
        mime: att.mime || result.contentType,
        size: result.data.length,
        buffer: result.data,
      });
    }
  }

  // Detect routes
  const routes: RouteType[] = [];
  const pdfFiles = attachments.filter((a) => a.extension === "pdf");
  const excelFiles = attachments.filter((a) => ["xlsx", "xls", "xlsm", "csv"].includes(a.extension));
  const notionLinks = extractNotionLinks(fullContent);
  const googleDriveLinks = extractGoogleDriveLinks(fullContent);
  const docSendLinks = extractDocSendLinks(fullContent);

  // Resolve tracking URLs (SendGrid, Mailchimp, etc.) to uncover hidden links
  if (docSendLinks.length === 0 && googleDriveLinks.length === 0 && notionLinks.length === 0) {
    const allHrefs = extractAllHrefUrls(bodyHtml);
    const trackingUrls = allHrefs.filter(isTrackingUrl);
    if (trackingUrls.length > 0) {
      console.log(`[parse-email] Found ${trackingUrls.length} tracking URL(s) — resolving redirects`);
      for (const tUrl of trackingUrls) {
        const resolved = await resolveTrackingUrl(tUrl);
        if (!resolved) continue;
        console.log(`[parse-email] Resolved: ${tUrl.slice(0, 60)}... → ${resolved}`);
        // Re-check resolved URL against all link patterns
        const extraDocSend = extractDocSendLinks(resolved);
        for (const ds of extraDocSend) if (!docSendLinks.includes(ds)) docSendLinks.push(ds);
        const extraGDrive = extractGoogleDriveLinks(resolved);
        for (const gd of extraGDrive) {
          if (!googleDriveLinks.some((g) => g.fileId === gd.fileId)) googleDriveLinks.push(gd);
        }
        const extraNotion = extractNotionLinks(resolved);
        for (const n of extraNotion) if (!notionLinks.includes(n)) notionLinks.push(n);
      }
    }
  }

  if (pdfFiles.length > 0) routes.push("pdf");
  if (excelFiles.length > 0) routes.push("excel");
  if (notionLinks.length > 0) routes.push("notion");
  if (googleDriveLinks.length > 0) routes.push("google_drive");
  if (docSendLinks.length > 0) routes.push("docsend");
  if (routes.length === 0) routes.push("text_only");

  console.log(`[parse-email] ${emailId}: ${attachments.length} attachments, ${inlineImages.length} inline images, routes: [${routes.join(", ")}]`);

  return {
    emailId,
    accountId: String(emailData.account_id || ""),
    threadId: String(emailData.thread_id || ""),
    messageId: String(emailData.message_id || ""),
    providerId: String(emailData.provider_id || ""),
    subject: String(emailData.subject || "(Sans objet)"),
    date: String(emailData.date || ""),
    bodyText,
    bodyHtml,
    from: { address: fromAttendee.identifier || "", name: fromAttendee.display_name || "" },
    to: toAttendees.map((a) => ({ address: a.identifier || "", name: a.display_name || "" })),
    cc: ccAttendees.map((a) => ({ address: a.identifier || "", name: a.display_name || "" })),
    attachments,
    inlineImages,
    routes,
    notionLinks,
    googleDriveLinks,
    docSendLinks,
  };
}
