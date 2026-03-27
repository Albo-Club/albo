import 'dotenv/config';

const KEY = process.env.UNIPILE_API_KEY;
const DSN = 'https://' + process.env.UNIPILE_DSN.trim();

const res = await fetch(`${DSN}/api/v1/emails/-YIH9vwPXwKIpbK_iAolfQ`, {
  headers: { 'X-API-KEY': KEY, accept: 'application/json' }
});
const d = await res.json();
const html = d.body || '';
const text = d.body_plain || '';

// Check for tally.so in href
const tallyMatches = html.match(/href=["'][^"']*tally\.so[^"']*["']/gi);
console.log('Tally href matches:', tallyMatches?.length || 0);
if (tallyMatches) tallyMatches.forEach(m => console.log(' ', m.slice(0, 150)));

// Simulate detectTally from download-deck.ts
const rx = /href=["']([^"']*storage\.tally\.so[^"']*)["']/gi;
let m;
while ((m = rx.exec(html)) !== null) {
  const url = m[1].replace(/&amp;/g, '&');
  try {
    const u = new URL(url);
    console.log('\nParsed Tally URL:');
    console.log('  id:', u.searchParams.get('id'));
    console.log('  accessToken:', u.searchParams.get('accessToken') ? 'YES' : 'NO');
    console.log('  signature:', u.searchParams.get('signature') ? 'YES' : 'NO');
    console.log('  → detectTally would return:', u.searchParams.get('id') && u.searchParams.get('accessToken') && u.searchParams.get('signature') ? 'MATCH' : 'NO MATCH');
  } catch(e) {
    console.log('URL parse error:', e.message);
  }
}

// Also check text body for tally link
const textTally = text.match(/https?:\/\/storage\.tally\.so[^\s>]*/gi);
console.log('\nTally links in plain text:', textTally?.length || 0);
