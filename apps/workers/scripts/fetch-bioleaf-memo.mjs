import 'dotenv/config';
import { writeFileSync } from 'fs';

const DSN = `https://${process.env.UNIPILE_DSN}`;
const API_KEY = process.env.UNIPILE_API_KEY;
const EMAIL_ID = 'oITiNkeQWAClVyMqebDcUg';

async function main() {
  const url = `${DSN}/api/v1/emails/${EMAIL_ID}`;
  console.log('Fetching:', url);

  const res = await fetch(url, {
    headers: { 'X-API-KEY': API_KEY }
  });

  if (!res.ok) {
    console.error('Failed:', res.status, await res.text());
    process.exit(1);
  }

  const detail = await res.json();

  console.log('Subject:', detail.subject);
  console.log('From:', JSON.stringify(detail.from));
  console.log('Date:', detail.date);

  const htmlBody = detail.body || detail.html_body || detail.body_html || '';

  if (!htmlBody) {
    console.error('No HTML body found. Keys:', Object.keys(detail));
    process.exit(1);
  }

  writeFileSync('/tmp/n8n-bioleaf-memo.html', htmlBody, 'utf-8');
  console.log(`\nSaved HTML body (${htmlBody.length} chars) to /tmp/n8n-bioleaf-memo.html`);

  console.log('\n========== FULL HTML BODY ==========');
  console.log(htmlBody);
}

main().catch(console.error);
