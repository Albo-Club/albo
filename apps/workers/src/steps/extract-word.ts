/**
 * Step: Extract Word document content via mammoth
 * Converts .docx to markdown text.
 */

import mammoth from "mammoth";

export async function extractWord(buffer: Buffer, fileName?: string): Promise<string> {
  const label = fileName || "document.docx";
  console.log(`[extract-word] Processing ${label} (${(buffer.length / 1024).toFixed(0)}KB)`);

  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();
    console.log(`[extract-word] Extracted ${text.length} chars from ${label}`);
    return text;
  } catch (err: any) {
    console.error(`[extract-word] Failed for ${label}:`, err.message);
    return "";
  }
}
