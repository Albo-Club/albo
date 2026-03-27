/**
 * Step: Download DocSend PDF
 *
 * Convertit un lien DocSend en PDF via docsend2pdf.com.
 * Utilisé par le pipeline report ET le pipeline deck.
 */

export interface DocSendFile {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  extension: string;
}

export async function downloadDocSend(
  url: string,
  senderEmail: string
): Promise<DocSendFile> {
  console.log(`[download-docsend] Converting: ${url}`);

  const res = await fetch("https://docsend2pdf.com/api/convert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, email: senderEmail }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`DocSend conversion failed (${res.status}): ${errText.substring(0, 200)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  console.log(`[download-docsend] Converted: ${(buffer.length / 1024).toFixed(0)}KB`);

  return {
    buffer,
    fileName: `docsend-${Date.now()}.pdf`,
    contentType: "application/pdf",
    extension: "pdf",
  };
}
