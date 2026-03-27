/**
 * Backfill: fill missing source_report_id on portfolio_company_metrics rows.
 * Matches by company_id + report_period against company_reports.
 * Safe to run multiple times (only updates NULL source_report_id).
 *
 * Usage: npx tsx scripts/backfill-source-report-id.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 500;

async function main() {
  console.log("[backfill-source] Starting source_report_id backfill...");

  // Build lookup: company_id + report_period → report_id (latest by processed_at)
  const { data: reports, error: reportsErr } = await supabase
    .from("company_reports")
    .select("id, company_id, report_period")
    .not("company_id", "is", null)
    .not("report_period", "is", null)
    .order("processed_at", { ascending: false });

  if (reportsErr) throw new Error(`Fetch reports failed: ${reportsErr.message}`);

  // First report wins (most recent processed_at)
  const lookup = new Map<string, string>();
  for (const r of reports || []) {
    const key = `${r.company_id}|${r.report_period}`;
    if (!lookup.has(key)) lookup.set(key, r.id);
  }
  console.log(`[backfill-source] Built lookup: ${lookup.size} company+period combos`);

  // Fetch metrics with NULL source_report_id
  let offset = 0;
  let updated = 0;
  let notFound = 0;

  while (true) {
    const { data: batch, error: fetchErr } = await supabase
      .from("portfolio_company_metrics")
      .select("id, company_id, report_period")
      .is("source_report_id", null)
      .range(offset, offset + BATCH_SIZE - 1)
      .order("id");

    if (fetchErr) throw new Error(`Fetch failed at offset ${offset}: ${fetchErr.message}`);
    if (!batch || batch.length === 0) break;

    for (const row of batch) {
      const key = `${row.company_id}|${row.report_period}`;
      const reportId = lookup.get(key);

      if (reportId) {
        const { error: upErr } = await supabase
          .from("portfolio_company_metrics")
          .update({ source_report_id: reportId })
          .eq("id", row.id);

        if (upErr) {
          console.error(`[backfill-source] Update failed for ${row.id}: ${upErr.message}`);
        } else {
          updated++;
        }
      } else {
        notFound++;
      }
    }

    offset += batch.length;
    console.log(`[backfill-source] Progress: ${offset} checked, ${updated} updated, ${notFound} no match`);
  }

  console.log(`[backfill-source] Done: ${updated} rows updated, ${notFound} unmatched`);
}

main().catch((err) => {
  console.error("[backfill-source] Fatal:", err.message);
  process.exit(1);
});
