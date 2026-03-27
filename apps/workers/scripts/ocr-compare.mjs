import 'dotenv/config';
import fs from 'fs';

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const buf = fs.readFileSync('/tmp/plantik-deck.pdf');
const base64 = buf.toString('base64');

console.log('Calling Mistral OCR...');
const start = Date.now();
const res = await fetch('https://api.mistral.ai/v1/ocr', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${MISTRAL_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'mistral-ocr-latest',
    document: { type: 'document_url', document_url: `data:application/pdf;base64,${base64}` },
  }),
});

if (!res.ok) { console.error('OCR failed:', res.status, await res.text()); process.exit(1); }
const data = await res.json();
const pages = data.pages || [];
const rawText = pages.map(p => p.markdown).join('\n\n---\n\n');
const elapsed = Date.now() - start;

fs.writeFileSync('/tmp/plantik-ocr-raw.txt', rawText);
console.log(`OCR done in ${elapsed}ms — ${rawText.length} chars, ${pages.length} pages`);

// Show sample of raw artifacts
const imgRefs = (rawText.match(/!\[.*?\]\(.*?\)/g) || []);
console.log(`\nImage references: ${imgRefs.length}`);
imgRefs.slice(0, 5).forEach(r => console.log('  ', r.slice(0, 100)));

// Count noise patterns
const noise = {
  imgRefs: imgRefs.length,
  emptyLines: (rawText.match(/\n{3,}/g) || []).length,
  pageSeps: (rawText.match(/---/g) || []).length,
};
console.log('\nNoise stats:', noise);

console.log('\n=== SAMPLE: chars 0-1500 ===');
console.log(rawText.slice(0, 1500));
console.log('\n=== SAMPLE: chars 20000-21500 ===');
console.log(rawText.slice(20000, 21500));
