/**
 * Deck Pipeline
 * Orchestrates the full deck processing flow for deck@alboteam.com.
 *
 * Equivalent of the entire N8N workflow "deck@alboteam.com unipile webhook"
 *
 * Flow:
 * 1. parseEmail          → download attachments, detect content types
 * 2. checkAccount        → does sender have a profile?
 *    └─ NO  → sendInvitationEmail → FIN
 * 3. downloadDeck        → detect route (6 types) + download PDF
 * 4. ocrDeck             ┐
 * 5. cleanEmail          ├─ en parallèle
 * 5b. extractExtraSources┘ (Notion, etc.)
 * 6. callDeckAnalysis    → Mastra agent → JSON structuré (reçoit OCR + email + Notion + langue)
 * 7. buildMemoHtml       → JSON → HTML (templating déterministe, bilingue)
 * 8. createDeal          → insert deal Supabase
 * 9. storeDeckFiles      → upload PDF Storage + deck_files
 * 10. updateDeal         → PATCH deal avec memo_html + additional_context
 * 11. sendMemoEmail      → envoi via Unipile au sender + CC (apparaît dans Gmail "Envoyés")
 */

import { parseEmail } from "../steps/parse-email";
import { checkAccount } from "../steps/deck/check-account";
import { downloadDeck } from "../steps/deck/download-deck";
import { ocrDeck } from "../steps/deck/ocr-deck";
import { cleanDeckEmail } from "../steps/deck/clean-email";
import { extractExtraSources } from "../steps/deck/extract-extra-sources";
import { extractAllFiles, type UploadedFile } from "../steps/deck/extract-files";
import { parseTallyForm, tallyFormToMarkdown } from "../steps/deck/parse-tally-form";
import { callDeckAnalysis } from "../steps/deck/call-deck-analysis";
import { buildMemoHtml } from "../steps/deck/build-memo-html";
import { createDeal, updateDealWithMemo } from "../steps/deck/create-deal";
import { storeDeckFiles } from "../steps/deck/store-deck-files";
import {
  sendMemoEmail,
  sendInvitationEmail,
  sendErrorEmail,
} from "../steps/deck/send-memo-email";
import { createPipelineLogger, type PipelineContext } from "../lib/logger";

export interface DeckPipelineResult {
  success: boolean;
  dealId?: string;
  companyName?: string;
  error?: string;
  durationMs: number;
}

export async function runDeckPipeline(
  webhookPayload: Record<string, unknown>
): Promise<DeckPipelineResult> {
  const startTime = Date.now();
  const runId = crypto.randomUUID();
  const logCtx: PipelineContext = {
    runId,
    pipeline: "deck",
    unipileEmailId: String(webhookPayload.email_id || webhookPayload.id || ""),
  };
  const log = createPipelineLogger(logCtx);

  console.log(`\n[deck-pipeline] ========== RUN ${runId} ==========`);

  try {
    // --- Step 1: Parse email ---
    await log("pipeline", "info", "Starting deck pipeline");
    const parsed = await parseEmail(webhookPayload);

    // Enrichir le contexte du logger
    logCtx.senderEmail = parsed.from.address;
    logCtx.emailSubject = parsed.subject;

    // Langue préférée : d'abord du payload webhook (edge function), sinon profil, sinon "fr"
    const webhookLang = webhookPayload.preferred_language as string | undefined;

    await log(
      "parse-email",
      "success",
      `Parsed: ${parsed.attachments.length} attachments, from: ${parsed.from.address}`
    );

    // --- Step 2: Check account ---
    const account = await checkAccount(parsed.from.address);
    if (account.profileId) logCtx.profileId = account.profileId;

    // Résoudre la langue : webhook > profil > "fr"
    const preferredLanguage = webhookLang || account.preferredLanguage || "fr";

    await log(
      "check-account",
      account.hasAccount ? "success" : "warn",
      account.hasAccount
        ? `Compte trouvé: ${account.profileId} (lang: ${preferredLanguage})`
        : `Pas de compte pour ${account.email}`
    );

    if (!account.hasAccount) {
      await sendInvitationEmail(parsed.from.address, parsed.from.address, parsed.accountId);
      await log("send-invitation", "success", `Invitation envoyée à ${parsed.from.address}`);
      return {
        success: true,
        companyName: undefined,
        error: undefined,
        durationMs: Date.now() - startTime,
      };
    }

    // --- Step 3: Download deck ---
    const deck = await downloadDeck(parsed);
    await log(
      "download-deck",
      deck.error ? "warn" : "success",
      deck.error
        ? `Download échoué (${deck.routeType}): ${deck.error}`
        : `Route: ${deck.routeType}, PDF: ${deck.pdfFileName || "none"}`
    );

    if (deck.error && !deck.textContent) {
      await sendErrorEmail(parsed.from.address, parsed.subject, deck.error, parsed.accountId);
      await log("pipeline", "error", `Abandon: download échoué sans fallback texte`);
      return {
        success: false,
        error: deck.error,
        durationMs: Date.now() - startTime,
      };
    }

    // --- Steps 4+5 en parallèle : OCR deck + Clean email + Extra sources + PJ non-deck ---

    // Préparer les PJ non-deck (Excel, Word, images, autres PDF) pour extraction
    const nonDeckAttachments: UploadedFile[] = parsed.attachments
      .filter((a) => {
        // Exclure le PDF deck (déjà traité par downloadDeck + ocrDeck)
        if (a.extension === "pdf" && deck.routeType === "pdf_attachment") return false;
        // Garder tout le reste : Excel, Word, autres PDF, etc.
        return true;
      })
      .map((a) => ({
        buffer: a.buffer,
        originalname: a.name,
        mimetype: a.mime,
        size: a.size,
      }));

    const [ocr, cleaned, extraSources, attachmentExtracts] = await Promise.all([
      ocrDeck(deck.pdfBuffer, deck.pdfFileName, deck.textContent),
      Promise.resolve(
        cleanDeckEmail(
          parsed.bodyHtml,
          parsed.bodyText,
          parsed.subject,
          parsed.from.name || parsed.from.address.split("@")[0],
          parsed.from.address,
          parsed.date
        )
      ),
      extractExtraSources(parsed.bodyHtml, parsed.bodyText),
      nonDeckAttachments.length > 0
        ? extractAllFiles(nonDeckAttachments)
        : Promise.resolve(null),
    ]);

    // Parse Tally form (synchrone, instantané)
    const tallyForm = parseTallyForm(parsed.bodyHtml, parsed.bodyText, parsed.subject);

    await log("ocr-deck", "success", `OCR: ${ocr.charCount} chars`);
    await log("clean-email", "success", `Email nettoyé: ${cleaned.markdown.length} chars`);
    if (extraSources.sources.length > 0) {
      await log(
        "extra-sources",
        "success",
        `${extraSources.sources.length} source(s) extraite(s): ${extraSources.sources.map((s) => s.title).join(", ")} (${extraSources.combinedMarkdown.length} chars)`
      );
    }
    if (attachmentExtracts) {
      await log(
        "extract-attachments",
        "success",
        `PJ non-deck extraites: ${attachmentExtracts.summary}`
      );
    }
    if (tallyForm) {
      await log(
        "parse-tally",
        "success",
        `Tally: ${tallyForm.allFields.length} champs (${tallyForm.companyName || "?"})`
      );
    }

    // Quand il n'y a pas de PDF (text_only) mais des PJ (Excel, Word, images),
    // le contenu principal doit inclure les PJ — sinon l'agent n'a que le body email
    const MAX_CONTENT_CHARS = 150_000; // Cap pour l'agent Mastra (~40K tokens)
    let primaryContent = ocr.cleanedText;
    let attachmentUsedAsPrimary = false;
    if (deck.routeType === "text_only" && attachmentExtracts?.combinedText) {
      primaryContent = [primaryContent, attachmentExtracts.combinedText]
        .filter(Boolean)
        .join("\n\n");
      attachmentUsedAsPrimary = true;
      console.log(`[deck-pipeline] text_only + PJ: contenu principal enrichi (${primaryContent.length} chars)`);
    }

    // Cap le contenu principal pour ne pas saturer l'agent Mastra
    if (primaryContent.length > MAX_CONTENT_CHARS) {
      console.warn(`[deck-pipeline] primaryContent tronqué: ${primaryContent.length} → ${MAX_CONTENT_CHARS} chars`);
      primaryContent = primaryContent.slice(0, MAX_CONTENT_CHARS) + `\n\n[... tronqué à ${MAX_CONTENT_CHARS} caractères]`;
    }

    // Combiner le contenu additionnel (Notion + Tally form + PJ non-deck)
    // NB : si les PJ sont déjà dans primaryContent (text_only), ne pas les doubler ici
    const extraParts: string[] = [];
    if (extraSources.combinedMarkdown) extraParts.push(extraSources.combinedMarkdown);
    if (tallyForm) extraParts.push(tallyFormToMarkdown(tallyForm));
    if (attachmentExtracts?.combinedText && !attachmentUsedAsPrimary) {
      extraParts.push(attachmentExtracts.combinedText);
    }
    let extraContentMarkdown = extraParts.join("\n\n") || undefined;

    // Cap le contenu extra aussi
    if (extraContentMarkdown && extraContentMarkdown.length > MAX_CONTENT_CHARS) {
      console.warn(`[deck-pipeline] extraContent tronqué: ${extraContentMarkdown.length} → ${MAX_CONTENT_CHARS} chars`);
      extraContentMarkdown = extraContentMarkdown.slice(0, MAX_CONTENT_CHARS) + `\n\n[... tronqué]`;
    }

    // Utiliser l'email du contact Tally si disponible (pas l'adresse du forwarder)
    const contactEmail = tallyForm?.contactEmail || parsed.from.address;

    // --- Step 6: Call deck analysis (Mastra agent) ---
    let analysis;
    try {
      analysis = await callDeckAnalysis(
        primaryContent,
        cleaned.markdown,
        contactEmail,
        parsed.subject,
        deck.routeType,
        extraContentMarkdown,
        preferredLanguage
      );
      await log(
        "deck-analysis",
        "success",
        `Analysé: ${analysis.company_name} (${analysis.sector}) [lang: ${preferredLanguage}]`
      );
    } catch (err: any) {
      console.error(`[deck-pipeline] Analyse échouée:`, err.message);
      await log("deck-analysis", "error", err.message);
      await sendErrorEmail(parsed.from.address, parsed.subject, err.message, parsed.accountId);
      return {
        success: false,
        error: `Analyse échouée: ${err.message}`,
        durationMs: Date.now() - startTime,
      };
    }

    // --- Step 7: Build memo HTML ---
    const memoHtml = buildMemoHtml(analysis, preferredLanguage);
    await log("build-memo", "success", `Memo HTML: ${memoHtml.length} chars (lang: ${preferredLanguage})`);

    // --- Step 8: Create deal ---
    const deal = await createDeal(analysis, contactEmail);
    await log("create-deal", "success", `Deal créé: ${deal.dealId}`);

    // --- Step 9: Store deck files (PDF + tous les PJ) ---
    const additionalFilesToStore = nonDeckAttachments.map((a) => ({
      buffer: a.buffer,
      name: a.originalname,
      mime: a.mimetype,
      size: a.size,
    }));

    const stored = await storeDeckFiles(
      deal.dealId,
      contactEmail,
      deck.pdfBuffer,
      deck.pdfFileName,
      analysis.company_name,
      additionalFilesToStore.length > 0 ? additionalFilesToStore : undefined
    );
    if (stored) {
      const totalFiles = (deck.pdfBuffer ? 1 : 0) + additionalFilesToStore.length;
      await log("store-files", "success", `${totalFiles} fichier(s) stocké(s), premier: ${stored.storagePath}`);
    }

    // --- Step 10: Update deal with memo ---
    await updateDealWithMemo(
      deal.dealId,
      memoHtml,
      analysis.company_name,
      cleaned.htmlClean,
      extraContentMarkdown
    );
    await log("update-deal", "success", `Deal mis à jour avec memo`);

    // --- Step 11: Send memo email via Unipile (sender + CC) ---
    await sendMemoEmail(
      {
        to: contactEmail,
        accountId: parsed.accountId,
        cc: parsed.cc,
      },
      analysis.company_name,
      memoHtml
    );
    await log("send-memo", "success", `Memo envoyé à ${contactEmail} + ${parsed.cc.length} CC via Unipile`);

    const duration = Date.now() - startTime;
    await log("pipeline", "success", `Completed in ${duration}ms`);
    console.log(`[deck-pipeline] ========== DONE ${runId} (${duration}ms) ==========\n`);

    return {
      success: true,
      dealId: deal.dealId,
      companyName: analysis.company_name,
      durationMs: duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[deck-pipeline] FAILED ${runId}:`, error.message);
    await log("pipeline", "error", error.message);

    return {
      success: false,
      error: error.message,
      durationMs: duration,
    };
  }
}
