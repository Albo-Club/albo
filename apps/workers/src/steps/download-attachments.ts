import { supabase } from "../lib/supabase";

const UNIPILE_BASE = process.env.UNIPILE_DSN!;
const UNIPILE_TOKEN = process.env.UNIPILE_API_KEY!;

export interface Attachment {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  size: number;
}

interface DownloadResult {
  attachments: Attachment[];
  emailId: string;
}

export async function downloadAttachments(
  emailId: string,
  runId: string
): Promise<DownloadResult> {
  const stepName = "download-attachments";

  try {
    // 1. Fetch email metadata from Unipile
    const emailRes = await fetch(`${UNIPILE_BASE}/api/v1/emails/${emailId}`, {
      headers: { Authorization: `Bearer ${UNIPILE_TOKEN}` },
    });

    if (!emailRes.ok) {
      throw new Error(`Unipile email fetch failed: ${emailRes.status} ${emailRes.statusText}`);
    }

    const email = (await emailRes.json()) as { attachments?: { id: string; filename?: string; content_type?: string }[] };
    const rawAttachments = email.attachments ?? [];

    if (rawAttachments.length === 0) {
      await log(runId, stepName, "info", "No attachments found", { emailId });
      return { attachments: [], emailId };
    }

    // 2. Download each attachment
    const attachments: Attachment[] = [];

    for (const att of rawAttachments) {
      const dlRes = await fetch(
        `${UNIPILE_BASE}/api/v1/emails/${emailId}/attachments/${att.id}`,
        { headers: { Authorization: `Bearer ${UNIPILE_TOKEN}` } }
      );

      if (!dlRes.ok) {
        await log(runId, stepName, "warn", `Failed to download ${att.filename}`, {
          status: dlRes.status,
        });
        continue;
      }

      const buffer = Buffer.from(await dlRes.arrayBuffer());
      attachments.push({
        fileName: att.filename ?? `attachment-${att.id}`,
        mimeType: att.content_type ?? "application/octet-stream",
        buffer,
        size: buffer.length,
      });
    }

    await log(runId, stepName, "success", `Downloaded ${attachments.length} attachments`, {
      files: attachments.map((a) => ({ name: a.fileName, type: a.mimeType, size: a.size })),
    });

    return { attachments, emailId };
  } catch (error: any) {
    await log(runId, stepName, "error", error.message, { emailId });
    throw new Error(`[${stepName}] ${error.message}`);
  }
}

async function log(runId: string, step: string, level: string, message: string, meta?: any) {
  await supabase.from("pipeline_logs").insert({ run_id: runId, step, level, message, meta });
}
