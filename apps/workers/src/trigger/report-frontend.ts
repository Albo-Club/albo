/**
 * Trigger.dev Task: Report Frontend Pipeline
 *
 * Traite un report importé depuis le frontend (ImportReport).
 * Orchestrateur : chaque step est dans src/steps/report/.
 *
 * Flow: download → extract → analyze → validate → store → copy docs → metrics → notify
 *
 * Déclenché par : frontend → edge function report-import → tasks.trigger()
 */

import { schemaTask, logger, metadata, tags } from "@trigger.dev/sdk";
import { z } from "zod";
import { downloadReportFiles } from "../steps/report/download-report-files.js";
import { extractReportContent } from "../steps/report/extract-report-content.js";
import { copyToPortfolioDocs } from "../steps/report/copy-to-portfolio-docs.js";
import { upsertReportMetrics } from "../steps/report/upsert-report-metrics.js";
import { curateDisplayMetrics } from "../steps/report/curate-display-metrics.js";
import { analyzeReport } from "../steps/analyze-report.js";
import { validateResult } from "../steps/validate-result.js";
import { storeReport, type EmailMeta } from "../steps/store-report.js";
import { sendNotification } from "../steps/send-notification.js";

const storagePathSchema = z.object({
  path: z.string(),
  file_name: z.string(),
  mime_type: z.string(),
});

export const reportFrontendTask = schemaTask({
  id: "report-frontend",
  schema: z.object({
    company_id: z.string().uuid(),
    company_name: z.string(),
    workspace_id: z.string().uuid(),
    user_email: z.string().email(),
    additional_context: z.string().optional(),
    report_period: z.string().optional(),
    storage_paths: z.array(storagePathSchema).optional(),
  }),
  queue: { concurrencyLimit: 5 },
  retry: { maxAttempts: 3 },

  run: async (payload) => {
    const startTime = Date.now();
    const {
      company_id, company_name, workspace_id, user_email,
      additional_context, report_period: manualPeriod, storage_paths,
    } = payload;

    const files = storage_paths || [];
    logger.info("Starting report frontend pipeline", { company_id, company_name, filesCount: files.length });
    await tags.add(`company:${company_id}`);
    await tags.add(`workspace:${workspace_id}`);
    if (user_email) await tags.add(`user:${user_email}`);
    metadata.set("status", files.length === 0 ? "analyzing" : "downloading");
    metadata.set("companyName", company_name);

    // --- Step 1 : Download ---
    const downloadedFiles = await downloadReportFiles(files);

    if (downloadedFiles.length === 0 && !additional_context) {
      const errMsg = "Aucun fichier ni texte fourni";
      await sendErrorNotification(user_email, company_name, errMsg);
      metadata.set("status", "failed");
      return { success: false, error: errMsg, durationMs: Date.now() - startTime };
    }

    // --- Step 2 : Extract ---
    metadata.set("status", "extracting");
    const extraction = await extractReportContent(downloadedFiles, additional_context);

    if (!extraction.ocrContent) {
      const errMsg = "Aucun contenu extrait des fichiers uploadés";
      await sendErrorNotification(user_email, company_name, errMsg);
      metadata.set("status", "failed");
      return { success: false, error: errMsg, durationMs: Date.now() - startTime };
    }

    // --- Step 3 : Analyze ---
    metadata.set("status", "analyzing");
    const company = {
      found: true, companyId: company_id, companyName: company_name,
      workspaceId: workspace_id, domain: null,
      matchedBy: "frontend_import" as const, profileId: null,
    };

    const analysis = await analyzeReport(
      additional_context || "", extraction.ocrContent, company,
      `Import manuel - ${company_name}`, user_email, new Date().toISOString()
    );
    logger.info("Analysis complete", { reportTitle: analysis.reportTitle, reportPeriod: analysis.reportPeriod });

    // --- Step 4 : Validate ---
    const validated = validateResult(analysis);
    validated.companyId = company_id;
    validated.companyName = company_name;
    validated.workspaceId = workspace_id;
    if (manualPeriod) {
      logger.info(`Using manual period: "${manualPeriod}" (Claude inferred: "${validated.reportPeriod}")`);
      validated.reportPeriod = manualPeriod;
    }

    // --- Step 5 : Store ---
    metadata.set("status", "storing");
    const emailMeta: EmailMeta = {
      subject: `Import manuel - ${company_name}`, from: user_email, date: new Date().toISOString(),
    };
    // raw_content = additional_context si fourni (texte utilisateur prime sur OCR pour l'affichage)
    // L'OCR reste dans report_files.original_text_report
    const rawContentForDisplay = additional_context || extraction.ocrContent;
    const stored = await storeReport(
      validated,
      { textContent: additional_context || "", htmlContent: "", originalHtml: "", emailFrom: user_email, emailSubject: emailMeta.subject },
      extraction.filesToStore, emailMeta, rawContentForDisplay, additional_context
    );
    logger.info("Report stored", { reportId: stored.reportId, filesUploaded: stored.filesUploaded });
    metadata.set("reportId", stored.reportId);

    // --- Step 5b : Copy to portfolio_documents ---
    await copyToPortfolioDocs(company_id, stored.reportId, extraction.filesToStore);

    // --- Step 6 : Excel metrics ---
    await upsertReportMetrics(
      company_id, stored.reportId, validated.reportPeriod || "",
      extraction.excelMetrics, extraction.allExcelTexts
    );

    // --- Step 7 : Curate display metrics (Haiku) ---
    metadata.set("status", "curating_metrics");
    await curateDisplayMetrics(company_id);

    // --- Step 8 : Notification ---
    await sendNotification({
      to: user_email, subject: `Albote | ${company_name} - ${validated.reportPeriod}`,
      companyName: company_name, companyId: company_id,
      reportPeriod: validated.reportPeriod, reportType: validated.reportType || "monthly", success: true,
    });

    const durationMs = Date.now() - startTime;
    logger.info("Pipeline completed", { durationMs, companyName: company_name });
    metadata.set("status", "completed");
    metadata.set("durationMs", durationMs);

    return {
      success: true, reportId: stored.reportId, companyId: company_id,
      companyName: company_name, reportPeriod: validated.reportPeriod,
      filesCount: stored.filesUploaded, durationMs,
    };
  },
});

async function sendErrorNotification(userEmail: string, companyName: string, errorMessage: string): Promise<void> {
  await sendNotification({
    to: userEmail, subject: `Albote | Échec import report - ${companyName}`,
    companyName, companyId: "", reportPeriod: "", reportType: "monthly", success: false, errorMessage,
  });
}
