/**
 * Step: Convert Notion HTML to PDF via Puppeteer
 * Takes the HTML output from extractNotion and renders it to a styled PDF.
 */

import puppeteer from "puppeteer";

export async function notionToPdf(
  html: string,
  title: string
): Promise<{ buffer: Buffer; title: string }> {
  console.log(`[notion-to-pdf] Generating PDF for "${title}"`);

  const styledHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      font-size: 14px;
      line-height: 1.6;
      color: #1a1a1a;
    }
    h1 { font-size: 24px; margin-bottom: 24px; }
    h2 { font-size: 20px; margin-top: 28px; }
    h3 { font-size: 16px; margin-top: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 13px; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    blockquote { border-left: 3px solid #ddd; margin: 12px 0; padding: 8px 16px; color: #555; }
    .callout { background: #f7f7f7; border-radius: 4px; padding: 12px 16px; margin: 12px 0; }
    ul, ol { padding-left: 24px; }
    li { margin: 4px 0; }
    hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
    code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-size: 13px; }
    a { color: #2563eb; }
  </style>
</head>
<body>
${html}
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(styledHtml, { waitUntil: "networkidle0" });
    const pdfUint8 = await page.pdf({
      format: "A4",
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
      printBackground: true,
    });
    const pdfBuffer = Buffer.from(pdfUint8);
    console.log(`[notion-to-pdf] PDF generated: ${(pdfBuffer.length / 1024).toFixed(0)}KB`);
    return { buffer: pdfBuffer, title };
  } finally {
    await browser.close();
  }
}
