/**
 * Trigger.dev Task: Deck Inbox Pipeline
 *
 * Wrappe runDeckPipeline() pour les decks reçus par email (deck@alboteam.com).
 *
 * - Retry automatique (3 tentatives)
 * - Concurrency max 3 (rate limit Mastra agent)
 * - Metadata : company_name, step en cours
 *
 * Déclenché par : edge function email-router-webhook → tasks.trigger()
 */

import { schemaTask, logger, metadata, tags } from "@trigger.dev/sdk";
import { z } from "zod";
import { runDeckPipeline } from "../pipelines/deck-inbox.js";

export const deckInboxTask = schemaTask({
  id: "deck-inbox",
  schema: z.object({
    /** Payload brut du webhook Unipile (email complet) */
    webhookPayload: z.record(z.string(), z.unknown()),
  }),
  queue: {
    concurrencyLimit: 3,
  },
  retry: {
    maxAttempts: 3,
  },
  run: async (payload) => {
    const { webhookPayload } = payload;
    const emailId = String(webhookPayload.email_id || webhookPayload.id || "unknown");
    const subject = String(webhookPayload.subject || "");

    logger.info("Starting deck inbox pipeline", { emailId, subject });
    metadata.set("status", "processing");
    metadata.set("emailId", emailId);
    metadata.set("subject", subject);
    await tags.add(`email:${emailId}`);

    const result = await runDeckPipeline(webhookPayload);

    if (result.success) {
      logger.info("Deck inbox pipeline completed", {
        dealId: result.dealId,
        companyName: result.companyName,
        durationMs: result.durationMs,
      });
      metadata.set("status", "completed");
      metadata.set("companyName", result.companyName || "");
      metadata.set("dealId", result.dealId || "");
    } else {
      logger.error("Deck inbox pipeline failed", { error: result.error });
      metadata.set("status", "failed");
      metadata.set("error", result.error || "");
      throw new Error(`Deck inbox pipeline failed: ${result.error || "unknown"}`);
    }

    return result;
  },
});
