const BASE = 'https://melodic-mango-exabyte.mastra.cloud';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZWFtSWQiOiI3ZDI1NWNkMC01YjE1LTRjMTEtODAzZi04MWYzYmQ1NWIyMGYiLCJwcm9qZWN0SWQiOiJkNzFhZDIwOS0zMTEzLTQ4ZWQtYjkxMS1jYmEyNWY4Mzc5M2YiLCJ1bmlxdWVJZCI6IjNiMzNjYjcyLTAxOWMtNDIwMC1iMGFkLWM3ZTc4NDE5NDQ4NyIsImlhdCI6MTc3MTI1MDEzNn0.ClyOfQ1dS96BbyRdcb-tEd8uigp4StRFi-63flrh_88';

// 1. List agents
console.log('=== List agents ===');
const listRes = await fetch(`${BASE}/api/agents`, {
  headers: { 'Authorization': `Bearer ${TOKEN}`, 'x-mastra-access-token': TOKEN }
});
console.log('Status:', listRes.status);
const agents = await listRes.text();
console.log(agents.slice(0, 500));

// 2. Ping deck-analyzer
console.log('\n=== Ping deck-analyzer ===');
const pingRes = await fetch(`${BASE}/api/agents/deck-analyzer/generate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`,
    'x-mastra-access-token': TOKEN,
  },
  body: JSON.stringify({ messages: [{ role: 'user', content: 'Réponds juste "OK" en un mot.' }] }),
  signal: AbortSignal.timeout(30000),
});
console.log('Status:', pingRes.status);
const pingBody = await pingRes.text();
console.log(pingBody.slice(0, 500));
