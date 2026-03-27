import 'dotenv/config';

let DSN = (process.env.UNIPILE_DSN || '').trim();
if (!DSN.startsWith('http')) DSN = 'https://' + DSN;
const KEY = (process.env.UNIPILE_API_KEY || '').trim();

// Try without account_id filter first
const url = `${DSN}/api/v1/emails?limit=5`;
console.log('URL:', url);
console.log('KEY:', KEY.slice(0, 8) + '...');

const res = await fetch(url, {
  headers: { 'X-API-KEY': KEY, accept: 'application/json' }
});
console.log('Status:', res.status);
const text = await res.text();
console.log(text.slice(0, 500));
