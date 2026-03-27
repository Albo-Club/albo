import "dotenv/config";

const rawDsn = (process.env.UNIPILE_DSN || "").trim();
const UNIPILE_DSN = rawDsn.startsWith("http") ? rawDsn : `https://${rawDsn}`;
const UNIPILE_API_KEY = (process.env.UNIPILE_API_KEY || "").trim();

async function main() {
  const res = await fetch(
    `${UNIPILE_DSN}/api/v1/emails?account_id=_6sjZD6zSUmIEb1N8gqAow&limit=10`,
    { headers: { "X-API-KEY": UNIPILE_API_KEY, accept: "application/json" } }
  );
  const data = await res.json() as any;
  const emails = data.items || data;
  for (const e of emails) {
    const from = e.from_attendee?.identifier || "?";
    const to = (e.to_attendees || []).map((t: any) => t.identifier).join(", ");
    console.log(`${e.date} | ${e.id} | FROM: ${from} | TO: ${to} | ${e.subject}`);
  }
}
main();
