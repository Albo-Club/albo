import "dotenv/config";

const rawDsn = (process.env.UNIPILE_DSN || "").trim();
const UNIPILE_DSN = rawDsn.startsWith("http") ? rawDsn : `https://${rawDsn}`;
const UNIPILE_API_KEY = (process.env.UNIPILE_API_KEY || "").trim();
const ACCOUNT_ID = "_6sjZD6zSUmIEb1N8gqAow";

async function main() {
  console.log("DSN:", UNIPILE_DSN);
  console.log("API Key exists:", Boolean(UNIPILE_API_KEY));

  // Fetch memo HTML from Supabase deal
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dealId = "849bdf9e-ad83-482a-9601-737425e477bc";

  const dbRes = await fetch(
    `${supabaseUrl}/rest/v1/deals?id=eq.${dealId}&select=memo_html,company_name`,
    {
      headers: {
        apikey: supabaseKey!,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );
  const [deal] = (await dbRes.json()) as { memo_html: string; company_name: string }[];
  if (!deal?.memo_html) {
    console.error("No memo found for deal", dealId);
    return;
  }
  console.log(`Memo found: ${deal.company_name} (${deal.memo_html.length} chars)`);

  const payload = {
    account_id: ACCOUNT_ID,
    subject: `Albote｜Analyse ${deal.company_name}`,
    body: deal.memo_html,
    to: [{ identifier: "mael@alboteam.com" }],
  };

  console.log("Sending test email to mael@alboteam.com...");

  const res = await fetch(`${UNIPILE_DSN}/api/v1/emails`, {
    method: "POST",
    headers: {
      "X-API-KEY": UNIPILE_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  console.log("Status:", res.status);
  const body = await res.text();
  console.log("Response:", body);
}

main();
