/**
 * Step: Extract image content via Mistral OCR API
 * Used for inline email images (screenshots, charts, etc.)
 */

const MISTRAL_API_KEY = () => process.env.MISTRAL_API_KEY!;

export async function extractImage(buffer: Buffer, mime: string, fileName?: string): Promise<string> {
  const label = fileName || "image";
  console.log(`[extract-image] Processing ${label} (${(buffer.length / 1024).toFixed(0)}KB)`);

  try {
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mime};base64,${base64}`;

    const res = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-ocr-latest",
        document: { type: "image_url", image_url: dataUrl },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Mistral OCR ${res.status}: ${err}`);
    }

    const data = (await res.json()) as {
      pages?: { markdown: string }[];
    };

    const text = (data.pages || []).map((p) => p.markdown).join("\n\n");
    console.log(`[extract-image] Extracted ${text.length} chars from ${label}`);
    return text;
  } catch (err: any) {
    console.error(`[extract-image] Failed for ${label}:`, err.message);
    return "";
  }
}
