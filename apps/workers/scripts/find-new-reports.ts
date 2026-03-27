import "dotenv/config";

const UNIPILE_DSN = (() => {
  const raw = (process.env.UNIPILE_DSN || "").trim();
  return raw.startsWith("http") ? raw : `https://${raw}`;
})();
const UNIPILE_API_KEY = (process.env.UNIPILE_API_KEY || "").trim();
const ACCOUNT_ID = "_6sjZD6zSUmIEb1N8gqAow";

import { supabase } from "../src/lib/supabase";

async function main() {
  // Get all already-processed thread IDs
  const { data } = await supabase
    .from("company_reports")
    .select("source_thread_id")
    .not("source_thread_id", "is", null);
  const processed = new Set((data || []).map((r) => r.source_thread_id));
  console.log(`Already processed: ${processed.size} threads`);

  let cursor: string | undefined;
  const found: any[] = [];
  let pageNum = 0;

  while (found.length < 3) {
    pageNum++;
    const url = cursor
      ? `${UNIPILE_DSN}/api/v1/emails?account_id=${ACCOUNT_ID}&limit=50&cursor=${cursor}`
      : `${UNIPILE_DSN}/api/v1/emails?account_id=${ACCOUNT_ID}&limit=50`;
    const res = await fetch(url, {
      headers: { "X-API-KEY": UNIPILE_API_KEY, accept: "application/json" },
    });
    const page = (await res.json()) as any;

    for (const email of page.items || []) {
      const isReport = (email.to_attendees || []).some(
        (a: any) => a.identifier?.toLowerCase() === "report@alboteam.com"
      );
      if (!isReport) continue;
      if (processed.has(email.id)) continue;
      found.push({
        id: email.id,
        subject: email.subject,
        from: email.from_attendee?.identifier,
        date: email.date,
      });
      if (found.length >= 3) break;
    }

    cursor = page.cursor;
    if (!cursor || !page.items?.length) break;
    console.log(`Page ${pageNum}: scanned, ${found.length}/3 new report@ found`);
  }

  console.log("\n=== 3 NEW REPORT EMAILS ===");
  for (const e of found) {
    console.log(`  ${e.id} | "${e.subject}" | ${e.from} | ${e.date}`);
  }
}

main().catch(console.error);
