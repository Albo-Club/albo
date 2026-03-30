/**
 * Trigger.dev Task: Report Pipeline
 *
 * Wrappe runReportPipeline() dans une task Trigger.dev pour bénéficier de :
 * - Retry automatique (3 tentatives, backoff exponentiel)
 * - Monitoring via dashboard (status, durée, logs)
 * - Concurrency control (max 5 reports en parallèle)
 * - Metadata en temps réel (company_name, step en cours)
 *
 * Déclenché par : edge function email-router-webhook → tasks.trigger()
 */

import { schemaTask, logger, metadata, tags } from "@trigger.dev/sdk";
import { z } from "zod";
import { runReportPipeline, type PipelineOptions } from "../pipelines/report-pipeline.js";
import { curateDisplayMetrics } from "../steps/report/curate-display-metrics.js";

export const reportPipelineTask = schemaTask({
  id: "report-pipeline",
  schema: z.object({
    /** Payload brut du webhook Unipile (email complet) */
    webhookPayload: z.record(z.string(), z.unknown()),
    /** Options du pipeline (skipNotification, skipReportFilter, knownCompany) */
    options: z.object({
      skipNotification: z.boolean().optional(),
      skipReportFilter: z.boolean().optional(),
      knownCompany: z.object({
        companyId: z.string(),
        companyName: z.string(),
        workspaceId: z.string(),
      }).optional(),
      reprocessReportId: z.string().optional(),
    }).optional(),
  }),
  machine: { preset: "medium-1x" }, // 2 GB RAM — gros Excel (9 MB+)
  queue: {
    concurrencyLimit: 5,
  },
  retry: {
    maxAttempts: 3,
  },
  run: async (payload) => {
    const { webhookPayload, options } = payload;
    const emailId = String(webhookPayload.email_id || webhookPayload.id || "unknown");
    const subject = String(webhookPayload.subject || "");

    logger.info("Starting report pipeline", { emailId, subject });
    metadata.set("status", "processing");
    metadata.set("emailId", emailId);
    metadata.set("subject", subject);
    await tags.add(`email:${emailId}`);

    const result = await runReportPipeline(webhookPayload, options);

    if (result.success) {
      logger.info("Report pipeline completed", {
        reportId: result.reportId,
        companyName: result.companyName,
        durationMs: result.durationMs,
      });

      // Curate display metrics (non-blocking — pipeline already succeeded)
      if (result.companyId) {
        metadata.set("status", "curating_metrics");
        await curateDisplayMetrics(result.companyId);
      }

      metadata.set("status", "completed");
      metadata.set("companyName", result.companyName || "");
      metadata.set("reportId", result.reportId || "");
    } else {
      logger.error("Report pipeline failed", { error: result.error });
      metadata.set("status", "failed");
      metadata.set("error", result.error || "");
      throw new Error(`Report pipeline failed: ${result.error || "unknown"}`);
    }

    return result;
  },
});
