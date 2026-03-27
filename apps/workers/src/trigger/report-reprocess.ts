/**
 * Trigger.dev Task: Report Reprocess
 *
 * Re-extracts and re-analyzes reports from Supabase Storage files.
 * Concurrency 1 + wait between each report (rate limit Claude/Mistral).
 */

import { task, logger, metadata, wait } from "@trigger.dev/sdk";
import { supabase } from "../lib/supabase.js";
import { PIPELINE_VERSION } from "../lib/pipeline-version.js";
import { reprocessFromStorage } from "../steps/reprocess-from-storage.js";

interface ReprocessPayload {
  /** Specific report IDs to reprocess. If omitted, uses audit results. */
  reportIds?: string[];
  /** Override strategy — default "auto" picks based on available data */
  strategy?: "from-storage" | "from-email" | "auto";
  /** Minimum number of issues to qualify for reprocessing (default: 1) */
  minIssues?: number;
  /** Extract + analyze without saving (default: false) */
  dryRun?: boolean;
}

interface ReprocessResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: Array<{
    reportId: string;
    success: boolean;
    metricsCount?: number;
    rawContentLength?: number;
    error?: string;
  }>;
}

export const reportReprocessTask = task({
  id: "report-reprocess",
  queue: { concurrencyLimit: 1 },
  retry: { maxAttempts: 2 },
  run: async (payload: ReprocessPayload): Promise<ReprocessResult> => {
    const { strategy = "auto", dryRun = false } = payload;
    let reportIds = payload.reportIds;

    // If no specific IDs, find all reports that need reprocessing
    if (!reportIds || reportIds.length === 0) {
      logger.info("No reportIds provided — fetching outdated reports");

      const { data: outdated, error } = await supabase
        .from("company_reports")
        .select("id")
        .or(`pipeline_version.is.null,pipeline_version.lt.${PIPELINE_VERSION}`);

      if (error) throw new Error(`Failed to fetch outdated reports: ${error.message}`);

      reportIds = (outdated || []).map((r) => r.id);
      logger.info(`Found ${reportIds.length} outdated reports`);
    }

    // Filter to reports that have files in storage (from-storage strategy)
    if (strategy === "from-storage" || strategy === "auto") {
      const { data: filesCheck } = await supabase
        .from("report_files")
        .select("report_id")
        .in("report_id", reportIds);

      const reportsWithFiles = new Set((filesCheck || []).map((f) => f.report_id));

      if (strategy === "from-storage") {
        reportIds = reportIds.filter((id) => reportsWithFiles.has(id));
      }
      // For "auto", we'll check per-report in the loop
    }

    const total = reportIds.length;
    logger.info(`Reprocessing ${total} reports (strategy=${strategy}, dryRun=${dryRun})`);
    metadata.set("total", total).set("progress", 0).set("succeeded", 0).set("failed", 0).set("skipped", 0);

    const results: ReprocessResult["results"] = [];
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < reportIds.length; i++) {
      const reportId = reportIds[i];
      metadata.set("progress", Math.round(((i + 1) / total) * 100)).set("currentReport", reportId);

      try {
        if (dryRun) {
          // Dry run: just log what would happen
          logger.info(`[DRY RUN] Would reprocess ${reportId}`);
          results.push({ reportId, success: true });
          succeeded++;
        } else {
          const result = await reprocessFromStorage(reportId);
          results.push(result);
          if (result.success) {
            succeeded++;
            logger.info(`Reprocessed ${reportId}: ${result.metricsCount} metrics, ${result.rawContentLength} chars`);
          } else {
            skipped++;
            logger.warn(`Skipped ${reportId}: ${result.error}`);
          }
        }
      } catch (err: any) {
        failed++;
        logger.error(`Failed ${reportId}: ${err.message}`);
        results.push({ reportId, success: false, error: err.message });
      }

      metadata.set("succeeded", succeeded).set("failed", failed).set("skipped", skipped);

      // Rate limit: wait between each report to avoid hammering Claude/Mistral
      if (i < reportIds.length - 1) {
        await wait.for({ seconds: 2 });
      }
    }

    logger.info(`Reprocess complete: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped out of ${total}`);

    return { total, succeeded, failed, skipped, results };
  },
});
