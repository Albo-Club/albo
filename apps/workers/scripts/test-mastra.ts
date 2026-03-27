import "dotenv/config";

async function main() {
  const url = process.env.MASTRA_API_URL + "/api/agents/deck-analyzer/generate";
  const token = process.env.MASTRA_ACCESS_TOKEN || "";

  console.log("URL:", url);
  console.log("Token exists:", Boolean(token));

  try {
    const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "x-mastra-access-token": token,
      "User-Agent": "albote-worker/1.0",
    },
    body: JSON.stringify({
      messages: [{
        role: "user",
        content: `## Instructions
Write your ENTIRE analysis in English.

## Contexte email
- **Sujet** : BioLeaf - Impact Investment Opportunity
- **Expéditeur** : ziv@bioleaf-il.com
- **Source du deck** : pdf_attachment

## Contenu du deck (OCR)
BioLeaf develops eco-friendly postharvest solutions. Israeli company. Biodegradable technology that extends produce shelf life, reduces food loss, and increases income across the value chain. No specialized storage infrastructure needed. Well-suited for emerging markets.

CEO: Ziv Shomroni. Mobile: +972 544 983 901. Website: www.bioleaf-il.com

## Contenu de l'email
Dear Benjamin Bouquet, I am reaching out to introduce BioLeaf, an Israeli company developing eco-friendly postharvest solutions that extend produce shelf life, reduce food loss, and increase income across the value chain. Our biodegradable technology requires no specialized storage infrastructure, making it well-suited for emerging markets. I have attached a short one-pager.`
      }]
    }),
    signal: AbortSignal.timeout(200_000),
  });

  console.log("Status:", res.status);
  const json = await res.json() as { text?: string };
  console.log("Response text length:", (json.text || "").length);
  console.log("First 500 chars:", (json.text || "").slice(0, 500));
  } catch (err: any) {
    console.error("FETCH ERROR:", err.message);
    console.error("Error type:", err.constructor?.name);
    console.error("Cause:", err.cause);
  }
}

main();
