import 'dotenv/config';
import fs from 'fs';

const KEY = process.env.UNIPILE_API_KEY;
const DSN = 'https://' + process.env.UNIPILE_DSN.trim();
const MISTRAL_KEY = process.env.MISTRAL_API_KEY;

// 1. Fetch email
console.log('=== 1. FETCH EMAIL ===');
const emailRes = await fetch(`${DSN}/api/v1/emails/-YIH9vwPXwKIpbK_iAolfQ`, {
  headers: { 'X-API-KEY': KEY, accept: 'application/json' }
});
const email = await emailRes.json();
console.log('Subject:', email.subject);
console.log('From:', email.from_attendee?.identifier);

// 2. Parse Tally form fields from body
console.log('\n=== 2. PARSE TALLY FORM ===');
const bodyHtml = email.body || '';
const bodyText = email.body_plain || '';

// Extract fields from plain text (*Label*\nValue)
const textFields = [];
const rx = /\*([^*]+)\*\n([^\n*]+)/g;
let m;
while ((m = rx.exec(bodyText)) !== null) {
  textFields.push({ label: m[1].trim(), value: m[2].trim() });
}
for (const f of textFields) {
  console.log(`  ${f.label}: ${f.value}`);
}

// Extract Tally deck URL
const tallyUrlMatch = bodyHtml.match(/href=["']([^"']*storage\.tally\.so[^"']*)["']/i);
const deckUrl = tallyUrlMatch ? tallyUrlMatch[1].replace(/&amp;/g, '&') : null;
console.log('\nDeck URL:', deckUrl ? deckUrl.slice(0, 100) + '...' : 'NOT FOUND');

// 3. Download PDF from Tally
console.log('\n=== 3. DOWNLOAD TALLY PDF ===');
const t0 = Date.now();
const pdfRes = await fetch(deckUrl);
console.log('Status:', pdfRes.status);
const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
console.log('PDF size:', (pdfBuf.length / 1024).toFixed(0), 'KB');
console.log('Download time:', Date.now() - t0, 'ms');
fs.writeFileSync('/tmp/wilo-deck.pdf', pdfBuf);

// 4. OCR with Mistral
console.log('\n=== 4. MISTRAL OCR ===');
const t1 = Date.now();
const base64 = pdfBuf.toString('base64');
const ocrRes = await fetch('https://api.mistral.ai/v1/ocr', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${MISTRAL_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'mistral-ocr-latest',
    document: { type: 'document_url', document_url: `data:application/pdf;base64,${base64}` },
  }),
});
const ocrData = await ocrRes.json();
const pages = ocrData.pages || [];
const rawText = pages.map(p => p.markdown).join('\n\n---\n\n');
const ocrTime = Date.now() - t1;

// Strip noise
const cleanedText = rawText
  .replace(/!\[.*?\]\(.*?\)\n?/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/(\n---\n){2,}/g, '\n---\n')
  .trim();

console.log(`OCR: ${pages.length} pages, ${rawText.length} → ${cleanedText.length} chars (${ocrTime}ms)`);
console.log('\n--- FIRST 1500 chars ---');
console.log(cleanedText.slice(0, 1500));

// 5. Summary
console.log('\n=== 5. EXTRACTION SUMMARY ===');
console.log('Tally form fields:', textFields.length);
console.log('PDF size:', (pdfBuf.length / 1024).toFixed(0), 'KB');
console.log('OCR pages:', pages.length);
console.log('OCR cleaned chars:', cleanedText.length);
console.log('Total extraction time:', Date.now() - t0, 'ms');

// What would be sent to the agent:
const agentPayload = {
  deck_ocr_text: cleanedText.length + ' chars',
  email_markdown: bodyText.length + ' chars',
  tally_form: textFields,
  extra_content: 'none (no Notion links)',
};
console.log('\nAgent payload preview:', JSON.stringify(agentPayload, null, 2));
