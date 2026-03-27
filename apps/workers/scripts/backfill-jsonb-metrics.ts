/**
 * Backfill: copy metrics from company_reports.metrics JSONB into portfolio_company_metrics.
 * Targets reports that have JSONB metrics but 0 rows in the dedicated table.
 * Applies canonical_key + metric_category normalization.
 * Safe to run multiple times (upsert on company_id,metric_key,report_period).
 *
 * Usage: npx tsx scripts/backfill-jsonb-metrics.ts
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
  if (k.includes("rate") || k.includes("margin") || k.includes("churn")) return "percentage";
  if (k.includes("customers") || k.includes("employees") || k.includes("users")) return "number";
  return "currency";
}

async function main() {
  console.log("[backfill-jsonb] Starting JSONB → portfolio_company_metrics backfill...");

  // Find reports with JSONB metrics but no rows in portfolio_company_metrics
  const { data: reports, error: fetchErr } = await supabase
    .from("company_reports")
    .select("id, company_id, report_period, metrics")
    .not("metrics", "is", null)
    .neq("metrics", "{}");

  if (fetchErr) throw new Error(`Fetch reports failed: ${fetchErr.message}`);
  if (!reports || reports.length === 0) {
    console.log("[backfill-jsonb] No reports with JSONB metrics found.");
    return;
  }

  console.log(`[backfill-jsonb] Found ${reports.length} reports with JSONB metrics`);

  let totalInserted = 0;
  let reportsProcessed = 0;
  let reportsSkipped = 0;

  for (const report of reports) {
    if (!report.company_id || !report.metrics) continue;

    const metrics = report.metrics as Record<string, number>;
    const entries = Object.entries(metrics).filter(([, v]) => v !== null && v !== undefined);
    if (entries.length === 0) continue;

    // Check if this report already has rows in the table
    const { count, error: countErr } = await supabase
      .from("portfolio_company_metrics")
      .select("id", { count: "exact", head: true })
      .eq("source_report_id", report.id);

    if (countErr) {
      console.error(`[backfill-jsonb] Count failed for ${report.id}: ${countErr.message}`);
      continue;
    }

    if ((count || 0) > 0) {
      reportsSkipped++;
      continue;
    }

    // Build rows with normalization
    const rows = entries.map(([key, value]) => {
      const normalized = normalizeMetricKey(key);
      const period = normalized.extractedPeriod || report.report_period || "";
      return {
        company_id: report.company_id,
        metric_key: key,
        metric_value: String(value),
        metric_type: guessMetricType(key),
        report_period: period,
        source_report_id: report.id,
        canonical_key: normalized.canonicalKey,
        metric_category: normalized.category,
      };
    });

    const { error: upsertErr } = await supabase
      .from("portfolio_company_metrics")
      .upsert(rows, { onConflict: "company_id,metric_key,report_period" });

    if (upsertErr) {
      console.error(`[backfill-jsonb] Upsert failed for report ${report.id}: ${upsertErr.message}`);
    } else {
      totalInserted += rows.length;
      reportsProcessed++;
      console.log(`[backfill-jsonb] Report ${report.id}: ${rows.length} metrics upserted`);
    }
  }

  console.log(`[backfill-jsonb] Done: ${reportsProcessed} reports processed, ${reportsSkipped} skipped (already have rows), ${totalInserted} metrics upserted`);
}

main().catch((err) => {
  console.error("[backfill-jsonb] Fatal:", err.message);
  process.exit(1);
});
