const rawDsn = (process.env.UNIPILE_DSN || "").trim();
const UNIPILE_DSN = rawDsn.startsWith("http") ? rawDsn : `https://${rawDsn}`;
const UNIPILE_API_KEY = (process.env.UNIPILE_API_KEY || "").trim();

const headers = {
  "X-API-KEY": UNIPILE_API_KEY,
  accept: "application/json",
};

export interface UnipileAttachment {
  id: string;
  name: string;
  mime: string;
  extension: string;
  size: number;
  cid?: string;
}

export interface UnipileEmail {
  id: string;
  account_id: string;
  subject: string;
  body: string;
  body_plain: string;
  date: string;
  thread_id: string;
  message_id: string;
  provider_id: string;
  has_attachments: boolean;
  attachments: UnipileAttachment[];
  from_attendee: { identifier: string; display_name: string };
  to_attendees: { identifier: string; display_name: string }[];
  cc_attendees: { identifier: string; display_name: string }[];
  folders: unknown[];
}

export async function listEmails(
  accountId: string,
  limit: number = 10
): Promise<UnipileEmail[]> {
  const res = await fetch(
    `${UNIPILE_DSN}/api/v1/emails?account_id=${accountId}&limit=${limit}`,
    { headers }
  );
  if (!res.ok) {
    console.error(`[unipile] Failed to list emails: ${res.status}`);
    return [];
  }
  const data = (await res.json()) as { items?: UnipileEmail[] } | UnipileEmail[];
  return Array.isArray(data) ? data : data.items || [];
}

export async function fetchEmailDetail(emailId: string): Promise<UnipileEmail | null> {
  const res = await fetch(`${UNIPILE_DSN}/api/v1/emails/${emailId}`, {
    headers,
  });
  if (!res.ok) {
    console.error(`[unipile] Failed to fetch email ${emailId}: ${res.status}`);
    return null;
  }
  return res.json() as Promise<UnipileEmail>;
}

export async function downloadAttachment(
  emailId: string,
  attachmentId: string,
  accountId?: string,
  providerId?: string
): Promise<{ data: Buffer; contentType: string } | null> {
  // Use provider_id (Gmail) + account_id when available for reliable access to older emails
  const id = providerId || emailId;
  const query = accountId ? `?account_id=${accountId}` : "";
  const url = `${UNIPILE_DSN}/api/v1/emails/${id}/attachments/${attachmentId}${query}`;

  const res = await fetch(url, {
    headers: { "X-API-KEY": UNIPILE_API_KEY, accept: "*/*" },
  });
  if (!res.ok) {
    console.error(`[unipile] Failed to download attachment ${attachmentId}: ${res.status}`);
    return null;
  }
  const data = Buffer.from(await res.arrayBuffer());
  return { data, contentType: res.headers.get("content-type") || "application/octet-stream" };
}

// --- Thread fetching ---

/**
 * Récupère tous les emails d'un thread via Unipile.
 * Utilisé quand le webhook ne livre que le wrapper de forwarding (body tronqué).
 * Équivalent du noeud N8N "Get Thread".
 */
export async function fetchThread(
  accountId: string,
  threadId: string
): Promise<UnipileEmail[]> {
  const url = `${UNIPILE_DSN}/api/v1/emails?account_id=${accountId}&thread_id=${threadId}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error(`[unipile] Failed to fetch thread ${threadId}: ${res.status}`);
    return [];
  }
  const data = (await res.json()) as { items?: UnipileEmail[] } | UnipileEmail[];
  return Array.isArray(data) ? data : data.items || [];
}

// --- Email sending ---

export interface UnipileSendEmailOptions {
  accountId: string;
  to: { identifier: string; display_name?: string }[];
  cc?: { identifier: string; display_name?: string }[];
  bcc?: { identifier: string; display_name?: string }[];
  subject: string;
  body: string;
}

/**
 * Envoie un email via Unipile (apparaît dans "Envoyés" Gmail).
 * Utilise multipart/form-data comme requis par l'API.
 */
export async function sendEmail(options: UnipileSendEmailOptions): Promise<{ trackingId: string } | null> {
  const payload: Record<string, unknown> = {
    account_id: options.accountId,
    subject: options.subject,
    body: options.body,
    to: options.to,
  };
  if (options.cc?.length) payload.cc = options.cc;
  if (options.bcc?.length) payload.bcc = options.bcc;

  const res = await fetch(`${UNIPILE_DSN}/api/v1/emails`, {
    method: "POST",
    headers: {
      "X-API-KEY": UNIPILE_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error(`[unipile] Failed to send email: ${res.status} ${errBody.slice(0, 300)}`);
    return null;
  }

  const result = (await res.json()) as { tracking_id?: string };
  console.log(`[unipile] Email sent, tracking_id: ${result.tracking_id}`);
  return { trackingId: result.tracking_id || "" };
}
