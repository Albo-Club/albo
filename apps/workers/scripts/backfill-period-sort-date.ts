/**
 * Backfill: compute period_sort_date + normalize report_period display format
 * on both portfolio_company_metrics and company_reports.
 *
 * Usage: npx tsx scripts/backfill-period-sort-date.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { parsePeriodToSortDate, normalizePeriodDisplay } from "../src/lib/metric-aliases";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 500;

async function backfillTable(table: string) {
  console.log(`\n[backfill-sort] Processing ${table}...`);

  let offset = 0;
  let updated = 0;
  let failed = 0;
  let noParse = 0;

  while (true) {
    const { data: batch, error: fetchErr } = await supabase
      .from(table)
      .select("id, report_period")
      .range(offset, offset + BATCH_SIZE - 1)
      .order("id");

    if (fetchErr) throw new Error(`Fetch failed at offset ${offset}: ${fetchErr.message}`);
    if (!batch || batch.length === 0) break;

    for (const row of batch) {
      if (!row.report_period) continue;

      const sortDate = parsePeriodToSortDate(row.report_period);
      const normalizedPeriod = normalizePeriodDisplay(row.report_period);

      const updates: Record<string, any> = {};
      if (sortDate) {
        updates.period_sort_date = sortDate.toISOString().split("T")[0];
      } else {
        noParse++;
      }
      // Normalize display format if changed
      if (normalizedPeriod !== row.report_period) {
        updates.report_period = normalizedPeriod;
      }

      if (Object.keys(updates).length === 0) continue;

      const { error: upErr } = await supabase
        .from(table)
        .update(updates)
        .eq("id", row.id);

      if (upErr) {
        failed++;
        if (failed <= 5) console.error(`[backfill-sort] Update failed for ${row.id}: ${upErr.message}`);
      } else {
        updated++;
      }
    }

    offset += batch.length;
    if (offset % 2000 === 0) console.log(`[backfill-sort] ${table}: ${offset} rows checked, ${updated} updated`);
  }

  console.log(`[backfill-sort] ${table}: Done — ${updated} updated, ${noParse} unparseable, ${failed} failed`);
}

async function main() {
  console.log("[backfill-sort] Starting period_sort_date backfill...");

  // Show some examples of parsing
  const examples = [
    "January 2026", "September - Q3 2025", "September_-_Q3_2025",
    "Q4 2025", "November - December 2025", "2025", "February 2026",
  ];
  console.log("\n[backfill-sort] Parse examples:");
  for (const ex of examples) {
    const date = parsePeriodToSortDate(ex);
    const norm = normalizePeriodDisplay(ex);
    console.log(`  "${ex}" → sort: ${date?.toISOString().split("T")[0] || "NULL"}, display: "${norm}"`);
  }

  await backfillTable("portfolio_company_metrics");
  await backfillTable("company_reports");

  // Verify Goodvest AuM ordering
  const { data: goodvest } = await supabase
    .from("portfolio_company_metrics")
    .select("canonical_key, metric_value, report_period, period_sort_date")
    .eq("company_id", (await supabase.from("portfolio_companies").select("id").ilike("company_name", "%goodvest%").limit(1).single()).data?.id || "")
    .eq("canonical_key", "aum")
    .order("period_sort_date", { ascending: true });

  console.log("\n[backfill-sort] Goodvest AuM sorted by period_sort_date:");
  for (const row of goodvest || []) {
    console.log(`  ${row.period_sort_date} | ${row.report_period} | ${row.metric_value}`);
  }
}

main().catch((err) => {
  console.error("[backfill-sort] Fatal:", err.message);
  process.exit(1);
});
