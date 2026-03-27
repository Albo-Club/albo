/**
 * Pipeline: Deck Frontend
 * Analyse un deck soumis depuis le frontend (SubmitDeal.tsx).
 *
 * Différences avec deck-inbox.ts (email) :
 * - Le deal existe déjà (créé par le frontend, status: 'pending')
 * - Les fichiers sont déjà uploadés dans Storage par le frontend
 * - On reçoit les fichiers dans le FormData pour l'extraction
 * - Supporte multi-fichiers : PDF, Excel, Word, Images
 * - Pas de parseEmail / downloadDeck / checkAccount
 * - 3 checkpoints d'annulation via analysis_requests
 *
 * Flow:
 * 1. checkCancellation
 * 2. extractAllFiles   → route par type (PDF/Excel/Word/Image) + extraction parallèle
 * 3. updateDeckFileOcr → sauvegarde OCR dans deck_files.ocr_markdown
 * 4. checkCancellation
 * 5. callDeckAnalysis  → agent Mastra (reçoit tout le contenu combiné)
 * 6. checkCancellation
 * 7. buildMemoHtml     → JSON → HTML
 * 8. updateDealFull    → PATCH deal avec analyse + memo
 * 9. completeAnalysis  → analysis_requests.status = 'completed'
 * 10. sendNotification → email "Analyse terminée" via Unipile
 */

import { extractAllFiles, type UploadedFile } from "../steps/deck/extract-files";
import { callDeckAnalysis } from "../steps/deck/call-deck-analysis";
import { buildMemoHtml } from "../steps/deck/build-memo-html";
import { updateDealWithAnalysis } from "../steps/deck/create-deal";
import { sendEmail as sendViaUnipile } from "../lib/unipile";
import { supabase } from "../lib/supabase";
import { createPipelineLogger, type PipelineContext } from "../lib/logger";

export interface DeckFrontendPayload {
  deal_id: string;
  analysis_id: string;
  additional_context?: string;
  user_email: string;
  files: UploadedFile[];
}

export interface DeckFrontendResult {
  success: boolean;
  dealId?: string;
  companyName?: string;
  error?: string;
  cancelled?: boolean;
  durationMs: number;
}

// Unipile account pour envoyer les notifications
const UNIPILE_ACCOUNT_ID = "_6sjZD6zSUmIEb1N8gqAow";

export async function runDeckFrontendPipeline(
  payload: DeckFrontendPayload
): Promise<DeckFrontendResult> {
  const startTime = Date.now();
  const runId = crypto.randomUUID();
  const logCtx: PipelineContext = {
    runId,
    pipeline: "deck-frontend",
    senderEmail: payload.user_email,
  };
  const log = createPipelineLogger(logCtx);

  console.log(`\n[deck-frontend] ========== RUN ${runId} ==========`);
  console.log(`[deck-frontend] deal=${payload.deal_id} analysis=${payload.analysis_id} files=${payload.files.length}`);

  try {
    // --- Checkpoint 1 ---
    await log("pipeline", "info", `Starting deck-frontend pipeline (${payload.files.length} fichier(s))`);
    if (await isCancelled(payload.analysis_id)) {
      await log("pipeline", "warn", "Annulé par l'utilisateur (checkpoint 1)");
      return cancelled(startTime);
    }

    // --- Récupérer la langue préférée ---
    const preferredLanguage = await getUserLanguage(payload.user_email);

    // --- Step 2: Extraire tous les fichiers (PDF, Excel, Word, Images en parallèle) ---
    const extraction = await extractAllFiles(payload.files);
    await log("extract-files", "success", extraction.summary);

    if (!extraction.combinedText) {
      const errMsg = "Aucun contenu extrait des fichiers uploadés";
      await log("extract-files", "error", errMsg);
      await failAnalysis(payload.analysis_id, payload.deal_id, errMsg);
      return { success: false, error: errMsg, durationMs: Date.now() - startTime };
    }

    // --- Step 3: Sauvegarder OCR dans deck_files ---
    await updateDeckFilesOcr(payload.deal_id, extraction);

    // --- Checkpoint 2 ---
    if (await isCancelled(payload.analysis_id)) {
      await log("pipeline", "warn", "Annulé par l'utilisateur (checkpoint 2)");
      return cancelled(startTime);
    }

    // --- Step 5: Analyse deck (Mastra agent) ---
    // On envoie le contenu combiné de tous les fichiers comme "OCR text"
    // et le additional_context comme "email markdown" (champ contextuel)
    const mainFileName = payload.files[0]?.originalname || "deck";
    let analysis;
    try {
      analysis = await callDeckAnalysis(
        extraction.combinedText,
        payload.additional_context || "",
        payload.user_email,
        mainFileName,
        "pdf_attachment",
        payload.additional_context || undefined,
        preferredLanguage
      );
      await log(
        "deck-analysis",
        "success",
        `Analysé: ${analysis.company_name} (${analysis.sector}) [lang: ${preferredLanguage}]`
      );
    } catch (err: any) {
      console.error(`[deck-frontend] Analyse échouée:`, err.message);
      await log("deck-analysis", "error", err.message);
      await failAnalysis(payload.analysis_id, payload.deal_id, err.message);
      return {
        success: false,
        error: `Analyse échouée: ${err.message}`,
        durationMs: Date.now() - startTime,
      };
    }

    // --- Checkpoint 3 ---
    if (await isCancelled(payload.analysis_id)) {
      await log("pipeline", "warn", "Annulé par l'utilisateur (checkpoint 3)");
      return cancelled(startTime);
    }

    // --- Step 7: Build memo HTML ---
    const memoHtml = buildMemoHtml(analysis, preferredLanguage);
    await log("build-memo", "success", `Memo HTML: ${memoHtml.length} chars`);

    // --- Step 8: PATCH deal avec tous les résultats ---
    await updateDealWithAnalysis(payload.deal_id, analysis, memoHtml, payload.additional_context);
    await log("update-deal", "success", `Deal ${payload.deal_id} mis à jour`);

    // --- Step 9: analysis_requests → completed ---
    await completeAnalysis(payload.analysis_id);
    await log("complete-analysis", "success", "analysis_requests → completed");

    // --- Step 10: Email notification ---
    await sendNotificationEmail(payload.user_email, analysis.company_name, payload.deal_id);
    await log("send-notification", "success", `Notification envoyée à ${payload.user_email}`);

    const duration = Date.now() - startTime;
    await log("pipeline", "success", `Completed in ${duration}ms`);
    console.log(`[deck-frontend] ========== DONE ${runId} (${duration}ms) ==========\n`);

    return {
      success: true,
      dealId: payload.deal_id,
      companyName: analysis.company_name,
      durationMs: duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[deck-frontend] FAILED ${runId}:`, error.message);
    await log("pipeline", "error", error.message);
    await failAnalysis(payload.analysis_id, payload.deal_id, error.message);

    return {
      success: false,
      error: error.message,
      durationMs: duration,
    };
  }
}

// --- Helpers ---

async function isCancelled(analysisId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("analysis_requests")
    .select("status")
    .eq("id", analysisId)
    .single();

  if (error) {
    console.warn(`[deck-frontend] Impossible de vérifier annulation: ${error.message}`);
    return false; // En cas de doute, on continue
  }

  return data.status !== "running";
}

function cancelled(startTime: number): DeckFrontendResult {
  return {
    success: false,
    cancelled: true,
    error: "Analyse annulée par l'utilisateur",
    durationMs: Date.now() - startTime,
  };
}

async function getUserLanguage(email: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("email", email.toLowerCase().trim())
    .limit(1);

  return data?.[0]?.preferred_language || "fr";
}

async function updateDeckFilesOcr(
  dealId: string,
  extraction: { files: { fileName: string; category: string; content: string }[] }
): Promise<void> {
  // On met à jour le ocr_markdown pour chaque fichier PDF/Image du deal
  const ocrFiles = extraction.files.filter(
    (f) => (f.category === "pdf" || f.category === "image") && f.content
  );

  if (ocrFiles.length === 0) return;

  // Concaténer tout l'OCR pour le stocker dans deck_files
  const combinedOcr = ocrFiles.map((f) => `--- ${f.fileName} ---\n${f.content}`).join("\n\n");

  const { error } = await supabase
    .from("deck_files")
    .update({ ocr_markdown: combinedOcr })
    .eq("deal_id", dealId);

  if (error) {
    console.warn(`[deck-frontend] Échec MAJ deck_files.ocr_markdown: ${error.message}`);
  }
}

async function completeAnalysis(analysisId: string): Promise<void> {
  const { error } = await supabase
    .from("analysis_requests")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", analysisId);

  if (error) {
    console.error(`[deck-frontend] Échec MAJ analysis_requests: ${error.message}`);
  }
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

async function sendNotificationEmail(
  userEmail: string,
  companyName: string,
  dealId: string
): Promise<void> {
  const subject = `✅ Analyse terminée : ${companyName}`;
  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-bottom: 2px solid #1F77E0; padding-bottom: 15px; margin-bottom: 20px;">
    <h1 style="margin: 0; font-size: 24px; color: #1F77E0;">Albo</h1>
  </div>
  <h2 style="color: #333; font-size: 18px;">Votre analyse est prête</h2>
  <p style="color: #555; font-size: 14px; line-height: 1.6;">
    L'analyse du deal <strong>${escHtml(companyName)}</strong> est terminée et disponible sur votre tableau de bord.
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

  const result = await sendViaUnipile({
    accountId: UNIPILE_ACCOUNT_ID,
    to: [{ identifier: userEmail }],
    subject,
    body: html,
  });

  if (!result) {
    console.warn(`[deck-frontend] Échec envoi notification à ${userEmail}`);
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
