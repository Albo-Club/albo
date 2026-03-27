/**
 * Backfill: copy ALL metrics from company_reports.metrics JSONB into portfolio_company_metrics.
 * Unlike backfill-jsonb-metrics.ts (which only handled reports with 0 rows),
 * this script checks EVERY metric key in EVERY report and inserts missing ones.
 * This ensures historical data like AuM evolution is complete.
 *
 * Applies canonical_key + metric_category normalization.
 * Safe to run multiple times (upsert on company_id,metric_key,report_period).
 *
 * Usage: npx tsx scripts/backfill-all-jsonb-metrics.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { normalizeMetricKey } from "../src/lib/metric-aliases";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function guessMetricType(key: string): string {
  const k = key.toLowerCase();
  if (k.includes("months") || k.includes("runway")) return "months";
  if (k.includes("rate") || k.includes("margin") || k.includes("churn") || k.includes("pct")) return "percentage";
  if (k.includes("customers") || k.includes("employees") || k.includes("users") || k.includes("headcount")) return "number";
  return "currency";
}

const BATCH_SIZE = 50; // reports per batch

async function main() {
  console.log("[backfill-all] Starting full JSONB → portfolio_company_metrics backfill...");

  // Fetch all reports with JSONB metrics
  const { data: reports, error: fetchErr } = await supabase
    .from("company_reports")
    .select("id, company_id, report_period, metrics")
    .not("metrics", "is", null)
    .neq("metrics", "{}")
    .not("company_id", "is", null)
    .order("report_date", { ascending: true });

  if (fetchErr) throw new Error(`Fetch reports failed: ${fetchErr.message}`);
  if (!reports || reports.length === 0) {
    console.log("[backfill-all] No reports with JSONB metrics found.");
    return;
  }

  console.log(`[backfill-all] Found ${reports.length} reports with JSONB metrics`);

  let totalUpserted = 0;
  let totalSkipped = 0;

  // Process in batches
  for (let i = 0; i < reports.length; i += BATCH_SIZE) {
    const batch = reports.slice(i, i + BATCH_SIZE);
    const allRows: Array<{
      company_id: string;
      metric_key: string;
      metric_value: string;
      metric_type: string;
      report_period: string;
      source_report_id: string;
      canonical_key: string;
      metric_category: string;
    }> = [];

    for (const report of batch) {
      const metrics = report.metrics as Record<string, number>;
      const entries = Object.entries(metrics).filter(
        ([, v]) => v !== null && v !== undefined && !isNaN(Number(v))
      );

      for (const [key, value] of entries) {
        const normalized = normalizeMetricKey(key);
        const period = normalized.extractedPeriod || report.report_period || "";
        allRows.push({
          company_id: report.company_id,
          metric_key: key,
          metric_value: String(value),
          metric_type: guessMetricType(key),
          report_period: period,
          source_report_id: report.id,
          canonical_key: normalized.canonicalKey,
          metric_category: normalized.category,
        });
      }
    }

    if (allRows.length === 0) continue;

    // Deduplicate within batch: same (company_id, metric_key, report_period) → keep latest
    const dedupMap = new Map<string, typeof allRows[0]>();
    for (const row of allRows) {
      dedupMap.set(`${row.company_id}|${row.metric_key}|${row.report_period}`, row);
    }
    const dedupedRows = Array.from(dedupMap.values());

    const { error: upsertErr } = await supabase
      .from("portfolio_company_metrics")
      .upsert(dedupedRows, { onConflict: "company_id,metric_key,report_period" });

    if (upsertErr) {
      console.error(`[backfill-all] Upsert failed at batch ${i}: ${upsertErr.message}`);
    } else {
      totalUpserted += allRows.length;
      console.log(`[backfill-all] Batch ${i / BATCH_SIZE + 1}: ${allRows.length} metrics upserted (${i + batch.length}/${reports.length} reports)`);
    }
  }

  // Also re-normalize all existing rows (canonical_key may have changed with new aliases)
  console.log("[backfill-all] Re-normalizing all canonical_key + metric_category...");

  let offset = 0;
  let reNormalized = 0;

  while (true) {
    const { data: rows, error: rErr } = await supabase
      .from("portfolio_company_metrics")
      .select("id, metric_key, report_period")
      .range(offset, offset + 500 - 1)
      .order("id");

    if (rErr) throw new Error(`Re-normalize fetch failed: ${rErr.message}`);
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      const normalized = normalizeMetricKey(row.metric_key);
      const updates: Record<string, string> = {
        canonical_key: normalized.canonicalKey,
        metric_category: normalized.category,
      };
      if (normalized.extractedPeriod && !row.report_period) {
        updates.report_period = normalized.extractedPeriod;
      }

      const { error: upErr } = await supabase
        .from("portfolio_company_metrics")
        .update(updates)
        .eq("id", row.id);

      if (!upErr) reNormalized++;
    }

    offset += rows.length;
    if (offset % 2000 === 0) console.log(`[backfill-all] Re-normalized: ${offset} rows...`);
  }

  console.log(`[backfill-all] Done: ${totalUpserted} metrics upserted, ${reNormalized} rows re-normalized`);

  // Verification: check Goodvest AuM
  const { data: goodvest } = await supabase
    .from("portfolio_company_metrics")
    .select("metric_key, canonical_key, metric_value, report_period")
    .eq("company_id", (await supabase.from("portfolio_companies").select("id").ilike("company_name", "%goodvest%").limit(1).single()).data?.id || "")
    .or("canonical_key.eq.aum,metric_key.ilike.%aum%,metric_key.ilike.%assets_under%")
    .order("report_period");

  console.log("\n[backfill-all] Goodvest AuM verification:");
  for (const row of goodvest || []) {
    console.log(`  ${row.report_period}: ${row.metric_key} → ${row.canonical_key} = ${row.metric_value}`);
  }
}

main().catch((err) => {
  console.error("[backfill-all] Fatal:", err.message);
  process.exit(1);
});
