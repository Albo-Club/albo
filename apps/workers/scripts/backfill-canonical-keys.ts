/**
 * Backfill canonical_key + metric_category on all existing portfolio_company_metrics rows.
 * Safe to run multiple times (idempotent).
 *
 * Usage: npx tsx scripts/backfill-canonical-keys.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { normalizeMetricKey } from "../src/lib/metric-aliases";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 500;

async function main() {
  console.log("[backfill] Starting canonical_key backfill...");

  // Count total rows
  const { count, error: countErr } = await supabase
    .from("portfolio_company_metrics")
    .select("id", { count: "exact", head: true });

  if (countErr) throw new Error(`Count failed: ${countErr.message}`);
  console.log(`[backfill] Total rows: ${count}`);

  let offset = 0;
  let updated = 0;
  let periodExtracted = 0;

  while (true) {
    const { data: batch, error: fetchErr } = await supabase
      .from("portfolio_company_metrics")
      .select("id, metric_key, report_period")
      .range(offset, offset + BATCH_SIZE - 1)
      .order("id");

    if (fetchErr) throw new Error(`Fetch failed at offset ${offset}: ${fetchErr.message}`);
    if (!batch || batch.length === 0) break;

    // Build updates
    for (const row of batch) {
      const normalized = normalizeMetricKey(row.metric_key);

      const updates: Record<string, string> = {
        canonical_key: normalized.canonicalKey,
        metric_category: normalized.category,
      };

      // If period was extracted from key AND row has no report_period, fill it
      if (normalized.extractedPeriod && !row.report_period) {
        updates.report_period = normalized.extractedPeriod;
        periodExtracted++;
      }

      const { error: upErr } = await supabase
        .from("portfolio_company_metrics")
        .update(updates)
        .eq("id", row.id);

      if (upErr) {
        console.error(`[backfill] Update failed for ${row.id}: ${upErr.message}`);
      } else {
        updated++;
      }
    }

    offset += batch.length;
    console.log(`[backfill] Progress: ${offset}/${count} (${updated} updated, ${periodExtracted} periods extracted)`);
  }

  console.log(`[backfill] Done: ${updated} rows updated, ${periodExtracted} periods extracted from keys`);
}

main().catch((err) => {
  console.error("[backfill] Fatal:", err.message);
  process.exit(1);
});
