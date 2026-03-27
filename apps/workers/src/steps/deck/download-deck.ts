/**
 * Step: Download Deck
 * Detects the deck source from email content and downloads the PDF.
 *
 * 6 routes (priority order):
 * 1. pdf_attachment — PDF already in email attachments
 * 2. tally          — storage.tally.so URL with auth params
 * 3. google_drive   — drive.google.com / docs.google.com link
 * 4. docsend        — docsend.com link, converted via docsend2pdf.com
 * 5. deck_link      — tracking URL (SendBim, etc.) → follow redirects → re-route
 * 6. text_only      — no deck found, use email body
 */

import type { ParsedEmail, ParsedAttachment } from "../parse-email";

// --- Types ---

export type DeckRouteType =
  | "pdf_attachment"
  | "tally"
  | "google_drive"
  | "docsend"
  | "deck_link"
  | "text_only";

export interface DeckDownloadResult {
  routeType: DeckRouteType;
  pdfBuffer: Buffer | null;
  pdfFileName: string | null;
  sourceUrl: string | null;
  textContent: string | null; // for text_only route
  error?: string;
}

interface DetectedRoute {
  type: DeckRouteType;
  url?: string;
  attachment?: ParsedAttachment;
  confidence: "high" | "medium" | "low";
}

// --- Route detection ---

function detectTally(content: string): { url: string } | null {
  const rx = /href=["']([^"']*storage\.tally\.so[^"']*)["']/gi;
  let m;
  while ((m = rx.exec(content)) !== null) {
    try {
      // HTML encode: &amp; → &
      const rawUrl = m[1].replace(/&amp;/g, "&");
      const url = new URL(rawUrl);
      const id = url.searchParams.get("id");
      const accessToken = url.searchParams.get("accessToken");
      const signature = url.searchParams.get("signature");
      if (id && accessToken && signature) {
        return { url: rawUrl };
      }
    } catch {
      // invalid URL, skip
    }
  }
  return null;
}

function detectDocSend(content: string): { url: string; confidence: "high" | "medium" }[] {
  const results: { url: string; confidence: "high" | "medium" }[] = [];
  const seen = new Set<string>();

  // Direct docsend URLs (capture full path including optional slug: /v/CODE/slug)
  const patterns = [
    /https?:\/\/(www\.)?docsend\.com\/(view|v)\/[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*/gi,
    /https?:\/\/(www\.)?docsend\.com\/d\/[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*/gi,
    /https?:\/\/[a-zA-Z0-9-]+\.docsend\.com\/view\/[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*/gi,
  ];
  for (const rx of patterns) {
    let m;
    while ((m = rx.exec(content)) !== null) {
      const url = m[0];
      if (!seen.has(url)) {
        seen.add(url);
        results.push({ url, confidence: "high" });
      }
    }
  }

  // href attributes containing docsend
  const hrefRx = /href=["']([^"']*docsend[^"']*)["']/gi;
  let hm;
  while ((hm = hrefRx.exec(content)) !== null) {
    const url = hm[1];
    if (!seen.has(url)) {
      seen.add(url);
      results.push({ url, confidence: "high" });
    }
  }

  return results;
}

function detectGoogleDrive(content: string): { url: string; fileId: string; score: number }[] {
  const results: { url: string; fileId: string; score: number }[] = [];
  const seen = new Map<string, number>(); // fileId → index

  const patterns: { rx: RegExp; fileIdGroup: number }[] = [
    { rx: /https?:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)[^\s<")'"]*/gi, fileIdGroup: 1 },
    { rx: /https?:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/gi, fileIdGroup: 1 },
    { rx: /https?:\/\/docs\.google\.com\/(document|presentation|spreadsheets|drawings)\/d\/([a-zA-Z0-9_-]+)[^\s<")'"]*/gi, fileIdGroup: 2 },
  ];

  for (const p of patterns) {
    let m;
    while ((m = p.rx.exec(content)) !== null) {
      const fileId = m[p.fileIdGroup];
      const url = m[0].replace(/[<>"')]+$/, "");
      if (!seen.has(fileId)) {
        // Score based on context
        const contextStart = Math.max(0, m.index - 100);
        const contextEnd = Math.min(content.length, m.index + url.length + 100);
        const context = content.slice(contextStart, contextEnd).toLowerCase();

        let score = 0;
        const deckKeywords = [
          "pitch deck", "pitch-deck", "pitchdeck", "deck", "présentation",
          "presentation", "investor deck", "fundraising deck", "le deck",
          "the deck", "our deck", "ci-joint", "attached", "voici le", "slide", "slides",
        ];
        const annexKeywords = [
          "executive summary", "exec summary", "summary", "one-pager",
          "one pager", "onepager", "annexe", "annex", "appendix",
          "financials", "projections", "forecast", "data room", "dataroom",
          "teaser", "memo", "note",
        ];
        for (const kw of deckKeywords) if (context.includes(kw)) score += 10;
        for (const kw of annexKeywords) if (context.includes(kw)) score -= 5;

        // URL-based bonuses
        const urlLower = url.toLowerCase();
        if (urlLower.includes("deck") || urlLower.includes("pitch")) score += 5;
        if (urlLower.includes("summary") || urlLower.includes("annex")) score -= 3;
        if (urlLower.includes("presentation")) score += 8;
        if (urlLower.includes("spreadsheets")) score -= 3;

        seen.set(fileId, results.length);
        results.push({ url, fileId, score });
      }
    }
  }

  // Sort by score descending, first match gets +3 bonus
  results.sort((a, b) => b.score - a.score);
  if (results.length > 0) results[0].score += 3;

  return results;
}

const DECK_KEYWORDS = [
  "le deck", "the deck", "our deck", "pitch deck", "investor deck",
  "deck ici", "deck here", "voir le deck", "view deck", "access deck",
  "télécharger le deck", "download deck", "lien deck", "deck link",
  "présentation", "presentation",
];

const EXCLUDE_DOMAINS = [
  "drive.google.com", "docs.google.com", "docsend.com",
  "storage.tally.so", "unsubscribe", "désinscrire",
];

function detectDeckLink(content: string): { url: string; confidence: "high" | "medium" } | null {
  const linkRx = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRx.exec(content)) !== null) {
    const url = m[1];
    const anchorText = m[2].replace(/<[^>]+>/g, "").trim().toLowerCase();

    // Skip excluded domains
    if (EXCLUDE_DOMAINS.some((d) => url.toLowerCase().includes(d))) continue;

    // Check anchor text for deck keywords
    const matchesKeyword = DECK_KEYWORDS.some((kw) => anchorText.includes(kw));
    if (matchesKeyword) {
      const highConfidence = /le deck|pitch deck|the deck/i.test(anchorText);
      return { url, confidence: highConfidence ? "high" : "medium" };
    }
  }
  return null;
}

export function detectDeckRoute(parsed: ParsedEmail): DetectedRoute {
  const fullContent = parsed.bodyText + " " + parsed.bodyHtml;

  // 1. PDF attachment (>10KB)
  const pdfAttachment = parsed.attachments.find(
    (a) => a.extension === "pdf" && a.size > 10 * 1024
  );
  if (pdfAttachment) {
    return { type: "pdf_attachment", attachment: pdfAttachment, confidence: "high" };
  }

  // 2. Tally
  const tally = detectTally(fullContent);
  if (tally) {
    return { type: "tally", url: tally.url, confidence: "high" };
  }

  // 3. Google Drive
  const gdriveResults = detectGoogleDrive(fullContent);
  if (gdriveResults.length > 0) {
    return { type: "google_drive", url: gdriveResults[0].url, confidence: "high" };
  }

  // 4. DocSend
  const docsendResults = detectDocSend(fullContent);
  if (docsendResults.length > 0) {
    return { type: "docsend", url: docsendResults[0].url, confidence: docsendResults[0].confidence };
  }

  // 5. Deck link (tracking URL)
  const deckLink = detectDeckLink(fullContent);
  if (deckLink) {
    return { type: "deck_link", url: deckLink.url, confidence: deckLink.confidence };
  }

  // 6. Text only
  return { type: "text_only", confidence: "low" };
}

// --- Download functions ---

async function downloadTally(url: string): Promise<Buffer> {
  console.log(`[download-deck] Downloading from Tally: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tally download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function downloadDocSendBuffer(url: string, senderEmail: string): Promise<Buffer> {
  const { downloadDocSend: dl } = await import("../download-docsend.js");
  const result = await dl(url, senderEmail);
  return result.buffer;
}

async function downloadGoogleDrive(url: string): Promise<Buffer> {
  console.log(`[download-deck] Downloading from Google Drive: ${url}`);

  // Extract file ID from various Google Drive URL formats
  let fileId: string | null = null;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/(document|presentation|spreadsheets|drawings)\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const rx of patterns) {
    const m = rx.exec(url);
    if (m) {
      fileId = m[m.length === 3 ? 2 : 1];
      break;
    }
  }
  if (!fileId) throw new Error(`Could not extract Google Drive file ID from: ${url}`);

  // Try export as PDF first (works for Docs/Slides/Sheets)
  const exportUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const res = await fetch(exportUrl, { redirect: "follow" });
  if (!res.ok) {
    // Fallback: try direct download
    const directUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
    const res2 = await fetch(directUrl, { redirect: "follow" });
    if (!res2.ok) throw new Error(`Google Drive download failed: ${res2.status}`);
    return Buffer.from(await res2.arrayBuffer());
  }
  return Buffer.from(await res.arrayBuffer());
}

async function followTrackingLink(url: string): Promise<{ finalUrl: string; source: string }> {
  console.log(`[download-deck] Following tracking link: ${url}`);

  // Fetch without following redirects to capture Location header or HTML content
  const res = await fetch(url, { redirect: "manual" });

  // Check for HTTP redirect
  const location = res.headers.get("location");
  if (location) {
    console.log(`[download-deck] Redirect → ${location}`);
    return classifyUrl(location);
  }

  // Parse HTML response for meta refresh or JS redirect
  const html = await res.text();

  // Pattern 1: meta http-equiv="refresh" content="...;URL=..."
  const metaRx = /meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*;\s*url=["']?([^"'\s>]+)/i;
  const metaMatch = metaRx.exec(html);
  if (metaMatch) {
    console.log(`[download-deck] Meta refresh → ${metaMatch[1]}`);
    return classifyUrl(metaMatch[1]);
  }

  // Pattern 2: top.location='...' or window.location='...'
  const jsRx = /(?:top|window)\.location\s*=\s*['"]([^'"]+)['"]/i;
  const jsMatch = jsRx.exec(html);
  if (jsMatch) {
    const decoded = jsMatch[1].replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    ).replace(/\\\//g, "/");
    console.log(`[download-deck] JS redirect → ${decoded}`);
    return classifyUrl(decoded);
  }

  // Pattern 3: look for docsend URL in HTML
  const docsendRx = /https?:\/\/(www\.)?docsend\.com\/(view|v)\/[a-zA-Z0-9_-]+/i;
  const docsendMatch = docsendRx.exec(html);
  if (docsendMatch) {
    return { finalUrl: docsendMatch[0], source: "docsend" };
  }

  throw new Error(`Could not resolve tracking link: ${url}`);
}

function classifyUrl(url: string): { finalUrl: string; source: string } {
  const lower = url.toLowerCase();
  if (lower.includes("docsend.com")) return { finalUrl: url, source: "docsend" };
  if (lower.includes("drive.google.com") || lower.includes("docs.google.com"))
    return { finalUrl: url, source: "google_drive" };
  if (lower.includes("dropbox.com")) return { finalUrl: url, source: "dropbox" };
  if (lower.includes("notion.so") || lower.includes("notion.site"))
    return { finalUrl: url, source: "notion" };
  // Formulaires non-téléchargeables → pas un deck PDF
  if (lower.includes("typeform.com") || lower.includes("tally.so/r/"))
    return { finalUrl: url, source: "form" };
  return { finalUrl: url, source: "direct" };
}

// --- Main ---

export async function downloadDeck(
  parsed: ParsedEmail
): Promise<DeckDownloadResult> {
  const route = detectDeckRoute(parsed);
  console.log(`[download-deck] Route: ${route.type} (${route.confidence})`);

  try {
    switch (route.type) {
      case "pdf_attachment": {
        const att = route.attachment!;
        console.log(`[download-deck] Using PDF attachment: ${att.name} (${(att.size / 1024).toFixed(0)}KB)`);
        return {
          routeType: "pdf_attachment",
          pdfBuffer: att.buffer,
          pdfFileName: att.name,
          sourceUrl: null,
          textContent: null,
        };
      }

      case "tally": {
        const buffer = await downloadTally(route.url!);
        const fileName = extractFileName(route.url!) || "tally-deck.pdf";
        return {
          routeType: "tally",
          pdfBuffer: buffer,
          pdfFileName: fileName,
          sourceUrl: route.url!,
          textContent: null,
        };
      }

      case "docsend": {
        const buffer = await downloadDocSendBuffer(route.url!, parsed.from.address);
        return {
          routeType: "docsend",
          pdfBuffer: buffer,
          pdfFileName: "docsend-deck.pdf",
          sourceUrl: route.url!,
          textContent: null,
        };
      }

      case "google_drive": {
        const buffer = await downloadGoogleDrive(route.url!);
        return {
          routeType: "google_drive",
          pdfBuffer: buffer,
          pdfFileName: "gdrive-deck.pdf",
          sourceUrl: route.url!,
          textContent: null,
        };
      }

      case "deck_link": {
        const resolved = await followTrackingLink(route.url!);
        console.log(`[download-deck] Tracking link resolved to: ${resolved.source} → ${resolved.finalUrl}`);

        // Formulaires (Typeform, Tally) → pas un PDF, fallback text_only
        if (resolved.source === "form") {
          console.log(`[download-deck] Resolved to form URL, using text_only fallback`);
          return {
            routeType: "text_only",
            pdfBuffer: null,
            pdfFileName: null,
            sourceUrl: resolved.finalUrl,
            textContent: parsed.bodyText || parsed.bodyHtml,
          };
        }

        let buffer: Buffer;
        if (resolved.source === "docsend") {
          buffer = await downloadDocSendBuffer(resolved.finalUrl, parsed.from.address);
        } else if (resolved.source === "google_drive") {
          buffer = await downloadGoogleDrive(resolved.finalUrl);
        } else {
          // Direct file download
          const res = await fetch(resolved.finalUrl, { redirect: "follow" });
          if (!res.ok) throw new Error(`Direct download failed: ${res.status}`);
          buffer = Buffer.from(await res.arrayBuffer());
        }

        return {
          routeType: "deck_link",
          pdfBuffer: buffer,
          pdfFileName: "deck.pdf",
          sourceUrl: resolved.finalUrl,
          textContent: null,
        };
      }

      case "text_only": {
        console.log("[download-deck] No deck found, using email body");
        return {
          routeType: "text_only",
          pdfBuffer: null,
          pdfFileName: null,
          sourceUrl: null,
          textContent: parsed.bodyText || parsed.bodyHtml,
        };
      }
    }
  } catch (err: any) {
    console.error(`[download-deck] Failed (${route.type}):`, err.message);
    return {
      routeType: route.type,
      pdfBuffer: null,
      pdfFileName: null,
      sourceUrl: route.url || null,
      textContent: null,
      error: err.message,
    };
  }
}

function extractFileName(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && last.includes(".")) return decodeURIComponent(last);
  } catch {
    // ignore
  }
  return null;
}
