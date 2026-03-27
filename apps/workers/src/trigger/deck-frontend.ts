/**
 * Trigger.dev Task: Deck Frontend Pipeline
 *
 * Analyse un deck soumis depuis le frontend (SubmitDeal.tsx).
 *
 * Le frontend upload les fichiers dans Supabase Storage, puis trigger cette task
 * avec le deal_id et les chemins de fichiers. La task télécharge les fichiers depuis
 * Storage pour l'extraction/OCR.
 *
 * - Retry : 3 tentatives
 * - Concurrency : max 5 analyses simultanées
 * - Cancellation : 3 checkpoints via analysis_requests
 * - Metadata : progress, company_name
 *
 * Déclenché par : frontend → edge function → tasks.trigger()
 */

import { schemaTask, logger, metadata, tags } from "@trigger.dev/sdk";
import { z } from "zod";
import { extractAllFiles, type UploadedFile } from "../steps/deck/extract-files.js";
import { callDeckAnalysis } from "../steps/deck/call-deck-analysis.js";
import { buildMemoHtml } from "../steps/deck/build-memo-html.js";
import { updateDealWithAnalysis } from "../steps/deck/create-deal.js";
import { sendEmail as sendViaUnipile } from "../lib/unipile.js";
import { supabase } from "../lib/supabase.js";
import { UNIPILE_ACCOUNT_ID } from "../lib/constants.js";

const storagePathSchema = z.object({
  path: z.string(),
  file_name: z.string(),
  mime_type: z.string(),
});

export const deckFrontendTask = schemaTask({
  id: "deck-frontend",
  schema: z.object({
    deal_id: z.string().uuid(),
    analysis_id: z.string().uuid(),
    user_email: z.string().email(),
    additional_context: z.string().optional(),
    /** Chemins des fichiers dans Supabase Storage (bucket deck-files) */
    storage_paths: z.array(storagePathSchema),
  }),
  queue: {
    concurrencyLimit: 5,
  },
  retry: {
    maxAttempts: 3,
  },
  run: async (payload) => {
    const startTime = Date.now();
    const { deal_id, analysis_id, user_email, additional_context, storage_paths } = payload;

    logger.info("Starting deck frontend pipeline", { deal_id, filesCount: storage_paths.length });
    await tags.add(`deal:${deal_id}`);
    if (user_email) await tags.add(`user:${user_email}`);
    metadata.set("status", "downloading");
    metadata.set("dealId", deal_id);
    metadata.set("filesCount", storage_paths.length);

    // --- Checkpoint 1 ---
    if (await isCancelled(analysis_id)) {
      logger.warn("Cancelled at checkpoint 1");
      metadata.set("status", "cancelled");
      return { success: false, cancelled: true };
    }

    // --- Récupérer la langue préférée ---
    const preferredLanguage = await getUserLanguage(user_email);

    // --- Télécharger les fichiers depuis Supabase Storage ---
    const files: UploadedFile[] = [];
    for (const sp of storage_paths) {
      const { data, error } = await supabase.storage.from("deck-files").download(sp.path);
      if (error || !data) {
        logger.error(`Download failed: ${sp.path}`, { error: error?.message });
        continue;
      }
      const buffer = Buffer.from(await data.arrayBuffer());
      files.push({
        buffer,
        originalname: sp.file_name,
        mimetype: sp.mime_type,
        size: buffer.length,
      });
    }

    if (files.length === 0) {
      const errMsg = "Aucun fichier téléchargé depuis Storage";
      await failAnalysis(analysis_id, deal_id, errMsg);
      metadata.set("status", "failed");
      return { success: false, error: errMsg };
    }

    // --- Extraire tous les fichiers ---
    metadata.set("status", "extracting");
    const extraction = await extractAllFiles(files);
    logger.info("Extraction complete", { summary: extraction.summary });

    if (!extraction.combinedText) {
      const errMsg = "Aucun contenu extrait des fichiers";
      await failAnalysis(analysis_id, deal_id, errMsg);
      metadata.set("status", "failed");
      return { success: false, error: errMsg };
    }

    // --- Sauvegarder OCR dans deck_files ---
    const ocrFiles = extraction.files.filter(
      (f) => (f.category === "pdf" || f.category === "image") && f.content
    );
    if (ocrFiles.length > 0) {
      const combinedOcr = ocrFiles.map((f) => `--- ${f.fileName} ---\n${f.content}`).join("\n\n");
      await supabase.from("deck_files").update({ ocr_markdown: combinedOcr }).eq("deal_id", deal_id);
    }

    // --- Checkpoint 2 ---
    if (await isCancelled(analysis_id)) {
      logger.warn("Cancelled at checkpoint 2");
      metadata.set("status", "cancelled");
      return { success: false, cancelled: true };
    }

    // --- Analyse Mastra ---
    metadata.set("status", "analyzing");
    let analysis;
    try {
      analysis = await callDeckAnalysis(
        extraction.combinedText,
        additional_context || "",
        user_email,
        files[0]?.originalname || "deck",
        "pdf_attachment",
        additional_context || undefined,
        preferredLanguage
      );
      logger.info("Analysis complete", { companyName: analysis.company_name });
      metadata.set("companyName", analysis.company_name);
    } catch (err: any) {
      logger.error("Analysis failed", { error: err.message });
      await failAnalysis(analysis_id, deal_id, err.message);
      metadata.set("status", "failed");
      return { success: false, error: `Analyse échouée: ${err.message}` };
    }

    // --- Checkpoint 3 ---
    if (await isCancelled(analysis_id)) {
      logger.warn("Cancelled at checkpoint 3");
      metadata.set("status", "cancelled");
      return { success: false, cancelled: true };
    }

    // --- Build memo + update deal ---
    metadata.set("status", "finalizing");
    const memoHtml = buildMemoHtml(analysis, preferredLanguage);
    await updateDealWithAnalysis(deal_id, analysis, memoHtml, additional_context);

    // --- Complete analysis ---
    await supabase
      .from("analysis_requests")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", analysis_id);

    // --- Email notification ---
    await sendNotificationEmail(user_email, analysis.company_name, deal_id);

    const durationMs = Date.now() - startTime;
    logger.info("Pipeline completed", { durationMs, companyName: analysis.company_name });
    metadata.set("status", "completed");
    metadata.set("durationMs", durationMs);

    return {
      success: true,
      dealId: deal_id,
      companyName: analysis.company_name,
      durationMs,
    };
  },
});

// --- Helpers ---

async function isCancelled(analysisId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("analysis_requests")
    .select("status")
    .eq("id", analysisId)
    .single();

  if (error) return false;
  return data.status !== "running";
}

async function getUserLanguage(email: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("email", email.toLowerCase().trim())
    .limit(1);
  return data?.[0]?.preferred_language || "fr";
}

async function failAnalysis(analysisId: string, dealId: string, errorMessage: string): Promise<void> {
  await supabase
    .from("analysis_requests")
    .update({ status: "error", updated_at: new Date().toISOString() })
    .eq("id", analysisId);
  await supabase
    .from("deals")
    .update({ status: "error", error_message: errorMessage })
    .eq("id", dealId);
}

async function sendNotificationEmail(userEmail: string, companyName: string, dealId: string): Promise<void> {
  const subject = `✅ Analyse terminée : ${companyName}`;
  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-bottom: 2px solid #1F77E0; padding-bottom: 15px; margin-bottom: 20px;">
    <h1 style="margin: 0; font-size: 24px; color: #1F77E0;">Albo</h1>
  </div>
  <h2 style="color: #333; font-size: 18px;">Votre analyse est prête</h2>
  <p style="color: #555; font-size: 14px; line-height: 1.6;">
    L'analyse du deal <strong>${companyName.replace(/</g, "&lt;")}</strong> est terminée et disponible sur votre tableau de bord.
  </p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="https://app.alboteam.com/deal/${dealId}"
       style="display: inline-block; padding: 14px 28px; background: #1F77E0; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">
      Voir l'analyse
    </a>
  </div>
  <div style="border-top: 1px solid #eee; padding-top: 15px; margin-top: 30px; text-align: center;">
    <p style="color: #999; font-size: 12px;">Albote — Votre assistant d'investissement</p>
  </div>
</div>`;

  await sendViaUnipile({
    accountId: UNIPILE_ACCOUNT_ID,
    to: [{ identifier: userEmail }],
    subject,
    body: html,
  });
}
