/**
 * Report Pipeline
 * Orchestrates the full report processing flow.
 *
 * Equivalent of the entire N8N workflow "report@alboteam.com unipile webhook"
 *
 * Flow:
 * 1. parseEmail       → download attachments, detect content types
 * 2. cleanContent     → strip HTML, normalize text
 * 3. resolveCompany   → find company in Supabase
 * 4. analyzeReport    → Claude extracts structured data
 * 5. validateResult   → sanitize and validate
 * 6. storeReport      → persist to Supabase + upload files
 * 7. sendNotification → email confirmation
 */

import { parseEmail } from "../steps/parse-email";
import { extractPdf } from "../steps/extract-pdf";
import { extractNotion } from "../steps/extract-notion";
import { extractExcel } from "../steps/extract-excel";
import type { ExcelMetric } from "../steps/extract-excel";
import { extractExcelMetrics } from "../steps/extract-excel-metrics";
import { cleanEmailContent } from "../steps/clean-email-content";
import { resolveCompany } from "../steps/resolve-company";
import { analyzeReport } from "../steps/analyze-report";
import { validateResult } from "../steps/validate-result";
import { storeReport, updateReport } from "../steps/store-report";
import type { FileToStore } from "../steps/store-files";
import { sendNotification } from "../steps/send-notification";
import { extractImage } from "../steps/extract-image";
import { downloadGDrive } from "../steps/download-gdrive";
import { downloadDocSend } from "../steps/download-docsend";
import { supabase } from "../lib/supabase";
import { normalizeMetricKey, parsePeriodToSortDate, normalizePeriodDisplay } from "../lib/metric-aliases";
import { createPipelineLogger, type PipelineContext } from "../lib/logger";

export interface PipelineResult {
  success: boolean;
  reportId?: string;
  companyId?: string;
  companyName?: string;
  reportPeriod?: string;
  reportType?: string;
  filesCount?: number;
  error?: string;
  durationMs: number;
}

export interface PipelineOptions {
  skipNotification?: boolean;
  /** Skip the report@alboteam.com filter (for historical emails from email sync) */
  skipReportFilter?: boolean;
  /** Pre-resolved company (from email_company_matches — skip resolveCompany) */
  knownCompany?: {
    companyId: string;
    companyName: string;
    workspaceId: string;
  };
  /** When set, storeReport calls updateReport() instead of INSERT (for reprocessing) */
  reprocessReportId?: string;
}

export async function runReportPipeline(
  webhookPayload: Record<string, unknown>,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const startTime = Date.now();
  const runId = crypto.randomUUID();
  const logCtx: PipelineContext = {
    runId,
    pipeline: "report",
    unipileEmailId: String(webhookPayload.email_id || webhookPayload.id || ""),
  };
  const log = createPipelineLogger(logCtx);

  console.log(`\n[pipeline] ========== RUN ${runId} ==========`);

  try {
    // Step 1: Parse email + download attachments
    await log("pipeline", "info", "Starting report pipeline");
    const parsed = await parseEmail(webhookPayload);

    // Enrichir le contexte du logger avec les infos du mail parsé
    logCtx.senderEmail = parsed.from.address;
    logCtx.emailSubject = parsed.subject;

    await log("parse-email", "success", `Parsed: ${parsed.attachments.length} attachments, routes: [${parsed.routes}]`);

    // Filtre : ne traiter que les emails adressés à report@alboteam.com
    // (sauf si skipReportFilter — emails historiques depuis email sync)
    if (!options.skipReportFilter) {
      const toAddresses = parsed.to.map((t) => t.address.toLowerCase());
      const isReportEmail = toAddresses.some((a) => a === "report@alboteam.com");
      if (!isReportEmail) {
        await log("pipeline", "skip", `Destinataire: [${toAddresses.join(", ")}] — pas report@alboteam.com`);
        return {
          success: false,
          error: `Not addressed to report@alboteam.com (to: ${toAddresses.join(", ")})`,
          durationMs: Date.now() - startTime,
        };
      }
    }

    // Step 2: Clean content
    const cleaned = cleanEmailContent(
      parsed.bodyHtml,
      parsed.bodyText,
      parsed.from.address,
      parsed.subject
    );
    await log("clean-content", "success", `Cleaned content: ${cleaned.textContent.length} chars`);

    // Step 3: Resolve company
    // Si knownCompany fourni (email historique), on skip la résolution
    let company: ReturnType<typeof resolveCompany> extends Promise<infer T> ? T : never;
    if (options.knownCompany) {
      company = {
        found: true,
        companyId: options.knownCompany.companyId,
        companyName: options.knownCompany.companyName,
        workspaceId: options.knownCompany.workspaceId,
        domain: null,
        matchedBy: "email_sync_match",
        profileId: null,
      };
      await log("resolve-company", "success",
        `Pre-resolved: ${company.companyName} (from email sync match)`);
    } else {
      company = await resolveCompany(
        parsed.from.address,
        parsed.subject,
        cleaned.textContent
      );
      // Enrichir le contexte du logger avec le profileId
      if (company.profileId) logCtx.profileId = company.profileId;

      await log("resolve-company", company.found ? "success" : "warn",
        company.found
          ? `Found: ${company.companyName} (${company.matchedBy})`
          : "Company not found"
      );
    }

    // Step 3b-3d: Extract content from attachments
    // Track extracted text per file for storage in report_files
    let ocrContent: string | null = null;
    const extractedTexts = new Map<string, string>(); // attachment id → extracted text
    let notionHtmlFile: FileToStore | null = null;
    const notionFiles: FileToStore[] = [];
    let excelMetrics: ExcelMetric[] = [];
    const allExcelTexts: string[] = []; // Collect all Excel text for Claude metric extraction
    const gdriveFiles: FileToStore[] = []; // Google Drive downloaded files

    // Step 3b: Extract PDF content
    const pdfAttachments = parsed.attachments.filter((a) => a.extension === "pdf");
    if (pdfAttachments.length > 0) {
      const pdfTexts: string[] = [];
      for (const pdf of pdfAttachments) {
        const text = await extractPdf(pdf.buffer, pdf.name);
        pdfTexts.push(text);
        extractedTexts.set(pdf.id, text);
      }
      ocrContent = pdfTexts.join("\n\n---\n\n");
      await log("extract-pdf", "success", `Extracted ${pdfAttachments.length} PDF(s): ${ocrContent.length} chars`);
    }

    // Step 3c: Extract Notion content
    if (parsed.notionLinks.length > 0) {
      try {
        const notion = await extractNotion(parsed.notionLinks[0]);
        const notionText = notion.markdown;
        ocrContent = ocrContent
          ? `${ocrContent}\n\n--- CONTENU NOTION ---\n\n${notionText}`
          : notionText;
        await log("extract-notion", "success", `Extracted "${notion.title}": ${notionText.length} chars`);

        // Store Notion HTML directly (no Puppeteer dependency)
        const safeName = notion.title.replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "_");
        const htmlBuffer = Buffer.from(notion.html, "utf-8");
        notionHtmlFile = {
          buffer: htmlBuffer,
          name: `${safeName || "notion_report"}.html`,
          extension: "html",
          mime: "text/html",
          size: htmlBuffer.length,
          extractedText: notionText,
          htmlContent: notion.html,
        };

        // Process Notion file attachments (xlsx, pdf, etc.)
        for (const nf of notion.files) {
          notionFiles.push({
            buffer: nf.buffer,
            name: nf.name,
            extension: nf.extension,
            mime: nf.mime,
            size: nf.buffer.length,
          });

          // Extract Excel content from Notion xlsx attachments
          if (["xlsx", "xls", "xlsm"].includes(nf.extension)) {
            try {
              const result = extractExcel(nf.buffer, nf.name);
              excelMetrics.push(...result.metricsForDb);
              if (result.extractedText) allExcelTexts.push(`--- ${nf.name} ---\n${result.extractedText}`);
              const excelText = result.llmPrompt || result.extractedText;
              ocrContent = ocrContent
                ? `${ocrContent}\n\n--- CONTENU EXCEL NOTION (${nf.name}) ---\n\n${excelText}`
                : excelText;
              await log("extract-excel", "success",
                `Notion attachment "${nf.name}": ${result.sheetCount} sheets, ${result.rowCount} rows, ${result.metricsForDb.length} metrics`);
            } catch (excelErr: any) {
              console.error(`[pipeline] Excel extraction failed for Notion file ${nf.name}:`, excelErr.message);
              await log("extract-excel", "warn", `Failed Notion ${nf.name}: ${excelErr.message}`);
            }
          }
        }
        if (notion.files.length > 0) {
          await log("extract-notion", "success",
            `Downloaded ${notion.files.length} attachment(s): ${notion.files.map(f => f.name).join(", ")}`);
        }
      } catch (err: any) {
        console.error("[pipeline] Notion extraction failed:", err.message);
        await log("extract-notion", "error", `Failed: ${err.message}`);

        // Si Notion est la seule source de contenu (pas de PDF, pas d'Excel, pas d'images inline),
        // on ne peut pas créer un report utile → envoyer un email d'erreur et stopper
        const hasPdfContent = pdfAttachments.length > 0;
        const hasExcelContent = parsed.attachments.some((a) =>
          ["xlsx", "xls", "xlsm"].includes(a.extension));
        const hasInlineImages = parsed.inlineImages.length > 0;
        if (!hasPdfContent && !hasExcelContent && !hasInlineImages) {
          const notionUrl = parsed.notionLinks[0];
          const errorMsg = `La page Notion n'est pas accessible : ${notionUrl}\nErreur : ${err.message}\n\nVérifiez que la page est partagée publiquement ou que le lien est correct.`;

          if (!options.skipNotification) {
            await sendNotification({
              to: parsed.from.address,
              cc: parsed.cc.map((c) => c.address).filter(Boolean),
              subject: `Albote | Échec extraction Notion - ${parsed.subject}`,
              companyName: company.companyName || "Inconnu",
              companyId: company.companyId || "",
              reportPeriod: "",
              reportType: "monthly",
              success: false,
              errorMessage: errorMsg,
            });
          }

          return {
            success: false,
            error: `Notion extraction failed: ${err.message}`,
            durationMs: Date.now() - startTime,
          };
        }
      }
    }

    // Step 3d: Extract Excel content from email attachments
    const excelAttachments = parsed.attachments.filter((a) =>
      ["xlsx", "xls", "xlsm"].includes(a.extension)
    );
    if (excelAttachments.length > 0) {
      for (const excel of excelAttachments) {
        try {
          const result = extractExcel(excel.buffer, excel.name);
          excelMetrics.push(...result.metricsForDb);
          extractedTexts.set(excel.id, result.extractedText);
          if (result.extractedText) allExcelTexts.push(`--- ${excel.name} ---\n${result.extractedText}`);
          const excelText = result.llmPrompt || result.extractedText;
          ocrContent = ocrContent
            ? `${ocrContent}\n\n--- CONTENU EXCEL (${excel.name}) ---\n\n${excelText}`
            : excelText;
          await log("extract-excel", "success",
            `Extracted "${excel.name}": ${result.sheetCount} sheets, ${result.rowCount} rows, ${result.metricsForDb.length} metrics`);
        } catch (err: any) {
          console.error(`[pipeline] Excel extraction failed for ${excel.name}:`, err.message);
          await log("extract-excel", "warn", `Failed ${excel.name}: ${err.message}`);
        }
      }
    }

    // Step 3e: Download Google Drive files
    if (parsed.googleDriveLinks.length > 0) {
      for (const gdLink of parsed.googleDriveLinks) {
        try {
          const gd = await downloadGDrive(gdLink.url);
          await log("download-gdrive", "success",
            `Downloaded "${gd.fileName}" (${(gd.buffer.length / 1024).toFixed(0)}KB, ${gd.extension})`);

          // Extract content based on file type
          if (gd.extension === "pdf") {
            const text = await extractPdf(gd.buffer, gd.fileName);
            ocrContent = ocrContent
              ? `${ocrContent}\n\n--- GOOGLE DRIVE PDF (${gd.fileName}) ---\n\n${text}`
              : text;
            gdriveFiles.push({
              buffer: gd.buffer, name: gd.fileName, extension: "pdf",
              mime: "application/pdf", size: gd.buffer.length, extractedText: text,
            });
          } else if (["xlsx", "xls", "xlsm"].includes(gd.extension)) {
            const result = extractExcel(gd.buffer, gd.fileName);
            excelMetrics.push(...result.metricsForDb);
            if (result.extractedText) allExcelTexts.push(`--- ${gd.fileName} ---\n${result.extractedText}`);
            const excelText = result.llmPrompt || result.extractedText;
            ocrContent = ocrContent
              ? `${ocrContent}\n\n--- GOOGLE DRIVE EXCEL (${gd.fileName}) ---\n\n${excelText}`
              : excelText;
            gdriveFiles.push({
              buffer: gd.buffer, name: gd.fileName, extension: gd.extension,
              mime: gd.contentType, size: gd.buffer.length, extractedText: result.extractedText,
            });
            await log("extract-excel", "success",
              `GDrive "${gd.fileName}": ${result.sheetCount} sheets, ${result.rowCount} rows, ${result.metricsForDb.length} metrics`);
          } else {
            // Other file types (docx, images, etc.) — store as-is
            gdriveFiles.push({
              buffer: gd.buffer, name: gd.fileName, extension: gd.extension,
              mime: gd.contentType, size: gd.buffer.length,
            });
          }
        } catch (err: any) {
          console.error(`[pipeline] Google Drive download failed for ${gdLink.url}:`, err.message);
          await log("download-gdrive", "warn", `Failed ${gdLink.url}: ${err.message}`);
        }
      }
    }

    // Step 3f: OCR inline images BEFORE analysis (so Claude sees the financial data)
    const inlineImageTexts: string[] = [];
    const inlineExtractedTexts = new Map<string, string>(); // cid → ocr text
    if (parsed.inlineImages.length > 0) {
      for (const img of parsed.inlineImages) {
        const ocrText = await extractImage(img.buffer, img.mime, img.name);
        if (ocrText) inlineImageTexts.push(ocrText);
        inlineExtractedTexts.set(img.cid, ocrText);
      }
      if (inlineImageTexts.length > 0) {
        const inlineOcr = inlineImageTexts.join("\n\n---\n\n");
        ocrContent = ocrContent
          ? `${ocrContent}\n\n--- CONTENU OCR IMAGES INLINE ---\n\n${inlineOcr}`
          : inlineOcr;
      }
      await log("extract-inline-images", "success",
        `OCR'd ${parsed.inlineImages.length} inline images: ${inlineImageTexts.reduce((s, t) => s + t.length, 0)} chars total`);
    }

    // Step 3g: Download DocSend documents
    const docsendFiles: FileToStore[] = [];
    if (parsed.docSendLinks.length > 0) {
      for (const dsUrl of parsed.docSendLinks) {
        try {
          const ds = await downloadDocSend(dsUrl, parsed.from.address);
          await log("download-docsend", "success",
            `Downloaded DocSend: ${(ds.buffer.length / 1024).toFixed(0)}KB`);

          // Extract PDF text
          const text = await extractPdf(ds.buffer, ds.fileName);
          ocrContent = ocrContent
            ? `${ocrContent}\n\n--- DOCSEND (${dsUrl}) ---\n\n${text}`
            : text;

          docsendFiles.push({
            buffer: ds.buffer,
            name: ds.fileName,
            extension: "pdf",
            mime: "application/pdf",
            size: ds.buffer.length,
            extractedText: text,
          });
        } catch (err: any) {
          console.error(`[pipeline] DocSend download failed for ${dsUrl}:`, err.message);
          await log("download-docsend", "warn", `Failed ${dsUrl}: ${err.message}`);
        }
      }
    }

    // Step 4: Analyze report with Claude

    const analysis = await analyzeReport(
      cleaned.textContent || cleaned.htmlContent,
      ocrContent,
      company,
      parsed.subject,
      parsed.from.address,
      parsed.date
    );
    await log("analyze-report", "success",
      `Analyzed: ${analysis.reportTitle} (${analysis.reportPeriod}) [${analysis.reportAbout}]`);

    // Step 4b: Si Claude détecte un report de participation (fund → portfolio company),
    // on re-résout vers la company cible dans les workspaces du sender
    if (analysis.reportAbout === "fund_portfolio_company" && analysis.targetCompanyName) {
      await log("fund-redirect", "info",
        `Report de fond détecté — cible: "${analysis.targetCompanyName}"`);

      const targetCompany = await resolveCompany(
        parsed.from.address,
        analysis.targetCompanyName, // utiliser le nom cible comme "sujet"
        cleaned.textContent
      );

      if (targetCompany.found) {
        // Guard 1 : vérifier que le nom re-résolu correspond au target demandé par Claude
        const targetLower = analysis.targetCompanyName!.toLowerCase();
        const resolvedLower = targetCompany.companyName!.toLowerCase();
        const isGoodMatch = resolvedLower.includes(targetLower) || targetLower.includes(resolvedLower);

        // Guard 2 : si l'initial match existait ET le redirect pointe vers une company DIFFÉRENTE,
        // ne pas écraser — l'initial match (sujet/domaine) est plus fiable que l'inférence Claude
        // Ex: "Inari Properties" trouvé par sujet, Claude dit target "Virgil" → garder Inari
        const wouldChangeCompany = company.found && targetCompany.companyId !== company.companyId;

        if (!isGoodMatch) {
          await log("fund-redirect", "warn",
            `Re-résolution "${targetCompany.companyName}" ne correspond pas à "${analysis.targetCompanyName}" — redirect ignoré`);
        } else if (wouldChangeCompany) {
          await log("fund-redirect", "warn",
            `Redirect changerait "${company.companyName}" → "${targetCompany.companyName}" — initial match conservé (plus fiable)`);
        } else {
          analysis.companyId = targetCompany.companyId;
          analysis.companyName = targetCompany.companyName;
          analysis.workspaceId = targetCompany.workspaceId;
          await log("fund-redirect", "success",
            `Redirigé vers "${targetCompany.companyName}" (${targetCompany.matchedBy})`);
        }
      } else {
        await log("fund-redirect", "warn",
          `"${analysis.targetCompanyName}" non trouvé — report conservé sous le fond`);
      }
    }

    // Step 5: Validate
    const validated = validateResult(analysis);
    if (validated.validationErrors.length > 0) {
      await log("validate", "warn", `Validation: ${validated.validationErrors.length} errors fixed`);
    }

    // Step 6: Store report
    if (!validated.companyId) {
      await log("store-report", "error", "Cannot store: company not found");
      // Still notify about the failure
      if (!options.skipNotification) {
        await sendNotification({
          to: parsed.from.address,
          cc: parsed.cc.map((c) => c.address).filter(Boolean),
          subject: `Albote | Report non traité - ${parsed.subject}`,
          companyName: validated.companyName || "Inconnu",
          companyId: "",
          reportPeriod: validated.reportPeriod,
          reportType: validated.reportType || "monthly",
          success: false,
          errorMessage: "Entreprise non trouvée dans le portefeuille",
        });
      }
      return {
        success: false,
        error: "Company not found",
        durationMs: Date.now() - startTime,
      };
    }

    // Step 6a: Upload inline images to storage and replace cid: refs in HTML
    // (OCR already done in Step 3f — reuse inlineExtractedTexts)
    if (parsed.inlineImages.length > 0 && validated.companyId) {
      const SUPABASE_URL = process.env.SUPABASE_URL!;
      for (const img of parsed.inlineImages) {
        const ext = img.extension || "jpg";
        const storagePath = `${validated.companyId}/inline/${img.cid}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("report-files")
          .upload(storagePath, img.buffer, {
            contentType: img.mime,
            upsert: true,
          });
        if (uploadErr) {
          console.error(`[pipeline] Inline image upload failed for ${img.name}:`, uploadErr.message);
          continue;
        }
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/report-files/${storagePath}`;
        cleaned.originalHtml = cleaned.originalHtml.replace(
          new RegExp(`cid:${img.cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'),
          publicUrl
        );

        // Store OCR text from Step 3f for report_files insertion
        extractedTexts.set(img.cid, inlineExtractedTexts.get(img.cid) || "");
      }
      await log("inline-images", "success",
        `Uploaded ${parsed.inlineImages.length} inline images to storage`);
    }

    // Build files with extracted content for report_files storage
    const filesToStore: FileToStore[] = parsed.attachments.map((a) => ({
      buffer: a.buffer,
      name: a.name,
      extension: a.extension,
      mime: a.mime,
      size: a.size,
      extractedText: extractedTexts.get(a.id),
    }));

    // Add Notion HTML file if extracted
    if (notionHtmlFile) {
      filesToStore.push(notionHtmlFile);
    }

    // Add Notion file attachments (xlsx, pdf, etc.)
    filesToStore.push(...notionFiles);

    // Add Google Drive downloaded files
    filesToStore.push(...gdriveFiles);

    // Add DocSend downloaded files
    filesToStore.push(...docsendFiles);

    // Build raw_content: all extracted text combined for the company-intelligence agent
    // Note: inlineImageTexts are already included in ocrContent (from Step 3f)
    const rawContentParts: string[] = [];
    if (cleaned.textContent) rawContentParts.push(cleaned.textContent);
    if (ocrContent) rawContentParts.push(ocrContent);
    const rawContent = rawContentParts.length > 0 ? rawContentParts.join("\n\n---\n\n") : null;

    let stored: { reportId: string; companyId: string; filesUploaded: number };

    if (options.reprocessReportId) {
      // Reprocess path: update existing report instead of inserting
      const updated = await updateReport(
        options.reprocessReportId,
        validated,
        cleaned.originalHtml,
        filesToStore,
        rawContent
      );
      stored = {
        reportId: options.reprocessReportId,
        companyId: validated.companyId!,
        filesUploaded: updated.filesUploaded,
      };
      await log("store-report", "success",
        `Updated (reprocess): report=${stored.reportId}, files=${stored.filesUploaded}`);
    } else {
      stored = await storeReport(
        validated,
        cleaned,
        filesToStore,
        {
          subject: parsed.subject,
          from: parsed.from.address,
          date: parsed.date,
          messageId: parsed.messageId,
          threadId: parsed.threadId,
        },
        rawContent
      );
      await log("store-report", "success",
        `Stored: report=${stored.reportId}, files=${stored.filesUploaded}`);
    }

    // Step 6b: Insert inline images into report_files (file_type=inline_image, hidden from docs tab)
    if (parsed.inlineImages.length > 0) {
      for (const img of parsed.inlineImages) {
        const cleanName = img.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
        const ext = img.extension || "jpg";
        const storagePath = `${validated.companyId}/inline/${img.cid}.${ext}`;
        await supabase.from("report_files").insert({
          report_id: stored.reportId,
          file_name: cleanName,
          original_file_name: img.name,
          storage_path: storagePath,
          mime_type: img.mime,
          file_size_bytes: img.size,
          file_type: "inline_image",
          original_text_report: extractedTexts.get(img.cid) || null,
        });
      }
    }

    // Step 6c: Extract metrics from Excel via Claude Haiku + upsert
    if (allExcelTexts.length > 0) {
      try {
        const combinedExcelText = allExcelTexts.join("\n\n");
        const claudeMetrics = await extractExcelMetrics(
          combinedExcelText,
          validated.reportPeriod || stored.reportId
        );
        // Merge: Claude metrics + any from the legacy parser (deduplicated by key+period)
        const allMetrics = [...excelMetrics];
        const existingKeys = new Set(excelMetrics.map((m) => `${m.metric_key}|${m.report_period}`));
        for (const cm of claudeMetrics) {
          if (!existingKeys.has(`${cm.metric_key}|${cm.report_period}`)) {
            allMetrics.push(cm);
          }
        }

        // Deduplicate: Claude peut générer des doublons (même key+period)
        const dedupMap = new Map<string, typeof allMetrics[0]>();
        for (const m of allMetrics) dedupMap.set(`${m.metric_key}|${m.report_period}`, m);
        const dedupedMetrics = Array.from(dedupMap.values());

        if (dedupedMetrics.length > 0) {
          const { error: metricsError } = await supabase
            .from("portfolio_company_metrics")
            .upsert(
              dedupedMetrics.map((m) => {
                const normalized = normalizeMetricKey(m.metric_key);
                const period = normalizePeriodDisplay(normalized.extractedPeriod || m.report_period);
                const sortDate = parsePeriodToSortDate(period);
                return {
                  company_id: validated.companyId!,
                  metric_key: m.metric_key,
                  metric_value: m.metric_value,
                  metric_type: m.metric_type,
                  report_period: period,
                  source_report_id: stored.reportId,
                  canonical_key: normalized.canonicalKey,
                  metric_category: normalized.category,
                  period_sort_date: sortDate?.toISOString().split("T")[0] || null,
                };
              }),
              { onConflict: "company_id,metric_key,report_period" }
            );
          if (metricsError) {
            console.error("[pipeline] Excel metrics upsert failed:", metricsError.message);
          } else {
            await log("store-metrics", "success",
              `Upserted ${dedupedMetrics.length} Excel metrics (${claudeMetrics.length} via Claude, ${excelMetrics.length} via parser)`);
          }
        }
      } catch (err: any) {
        console.error("[pipeline] Excel metrics extraction error:", err.message);
        await log("store-metrics", "warn", `Excel metrics failed: ${err.message}`);
      }
    }

    // Step 7: Notify sender + cc
    if (!options.skipNotification) {
      await sendNotification({
        to: parsed.from.address,
        cc: parsed.cc.map((c) => c.address).filter(Boolean),
        subject: `Albote | ${validated.companyName} - ${validated.reportPeriod}`,
        companyName: validated.companyName || "",
        companyId: stored.companyId,
        reportPeriod: validated.reportPeriod,
        reportType: validated.reportType || "monthly",
        success: true,
      });
    }

    const duration = Date.now() - startTime;
    await log("pipeline", "success", `Completed in ${duration}ms`);
    console.log(`[pipeline] ========== DONE ${runId} (${duration}ms) ==========\n`);

    return {
      success: true,
      reportId: stored.reportId,
      companyId: stored.companyId,
      companyName: validated.companyName || undefined,
      reportPeriod: validated.reportPeriod || undefined,
      reportType: validated.reportType || undefined,
      filesCount: filesToStore.length + parsed.inlineImages.length,
      durationMs: duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[pipeline] FAILED ${runId}:`, error.message);
    await log("pipeline", "error", error.message);

    return {
      success: false,
      error: error.message,
      durationMs: duration,
    };
  }
}

