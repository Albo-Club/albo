/**
 * Step: Store Report
 * Equivalent N8N: "Create report" + "Upload storage" + "Insert report files" + "Update with Report"
 *
 * 1. Creates report entry in company_reports (with email metadata)
 * 2. Uploads files to Supabase Storage + inserts report_files rows (with extracted content)
 * 3. Updates report with analysis results + raw_content
 * 4. Inserts metrics into portfolio_company_metrics
 */

import { supabase } from "../lib/supabase";
import { PIPELINE_VERSION } from "../lib/pipeline-version";
import { normalizeMetricKey, parsePeriodToSortDate, normalizePeriodDisplay } from "../lib/metric-aliases";
import type { ReportAnalysis } from "./analyze-report";
import type { CleanedContent } from "./clean-email-content";
import { storeFiles, type FileToStore } from "./store-files";

export interface EmailMeta {
  subject: string;
  from: string;
  date: string;
  messageId?: string;
  threadId?: string;
}

export interface StoredReport {
  reportId: string;
  companyId: string;
  filesUploaded: number;
}

export async function storeReport(
  analysis: ReportAnalysis,
  cleanedContent: CleanedContent,
  files: FileToStore[],
  emailMeta: EmailMeta,
  rawContent: string | null,
  additionalContext?: string
): Promise<StoredReport> {
  if (!analysis.companyId) {
    throw new Error("[store-report] Cannot store report without company_id");
  }

  // Dedup guard for frontend imports (source_thread_id is NULL → unique constraint doesn't help)
  if (!emailMeta.threadId && analysis.reportPeriod) {
    const { data: existing } = await supabase
      .from("company_reports")
      .select("id")
      .eq("company_id", analysis.companyId)
      .eq("report_period", analysis.reportPeriod)
      .limit(1)
      .single();

    if (existing) {
      console.log(`[store-report] Duplicate detected: ${analysis.companyId} / ${analysis.reportPeriod} → updating existing ${existing.id}`);
      const updated = await updateReport(
        existing.id,
        analysis,
        cleanedContent.originalHtml,
        files,
        rawContent,
        additionalContext,
        emailMeta
      );
      return {
        reportId: existing.id,
        companyId: analysis.companyId,
        filesUploaded: updated.filesUploaded,
      };
    }
  }

  // 1. Create report entry with email metadata
  const reportSortDate = parsePeriodToSortDate(analysis.reportPeriod);
  const { data: report, error: createError } = await supabase
    .from("company_reports")
    .insert({
      company_id: analysis.companyId,
      report_title: analysis.reportTitle,
      processing_status: "pending",
      has_attachments: files.length > 0,
      report_period: normalizePeriodDisplay(analysis.reportPeriod),
      report_type: analysis.reportType,
      email_subject: emailMeta.subject,
      email_from: emailMeta.from,
      email_date: emailMeta.date || null,
      email_message_id: emailMeta.messageId || null,
      source_thread_id: emailMeta.threadId || null,
      sender_email: emailMeta.from,
      pipeline_version: PIPELINE_VERSION,
      period_sort_date: reportSortDate?.toISOString().split("T")[0] || null,
      additional_context: additionalContext || null,
    })
    .select("id, company_id")
    .single();

  // Auto-fallback to update if duplicate key (same company + thread)
  if (createError?.code === "23505" && emailMeta.threadId) {
    console.log(`[store-report] Duplicate thread detected — falling back to update`);
    const { data: existing } = await supabase
      .from("company_reports")
      .select("id")
      .eq("company_id", analysis.companyId)
      .eq("source_thread_id", emailMeta.threadId)
      .limit(1)
      .single();

    if (existing) {
      const updated = await updateReport(existing.id, analysis, cleanedContent.originalHtml, files, rawContent, additionalContext, emailMeta);
      return { reportId: existing.id, companyId: analysis.companyId!, filesUploaded: updated.filesUploaded };
    }
  }

  if (createError || !report) {
    throw new Error(`[store-report] Failed to create report: ${createError?.message}`);
  }

  console.log(`[store-report] Created report ${report.id}`);

  // 2. Upload files + insert report_files rows (with extracted content)
  const stored = await storeFiles(
    files,
    report.id,
    analysis.companyId,
    analysis.reportPeriod
  );

  // 3. Update report with analysis results + content
  const { error: updateError } = await supabase
    .from("company_reports")
    .update({
      report_period: analysis.reportPeriod,
      report_type: analysis.reportType,
      headline: analysis.headline,
      key_highlights: analysis.keyHighlights,
      metrics: analysis.metrics,
      processing_status: "completed",
      processed_at: new Date().toISOString(),
      cleaned_content: cleanedContent.originalHtml,
      raw_content: rawContent,
      report_date: analysis.reportDate,
      pipeline_version: PIPELINE_VERSION,
    })
    .eq("id", report.id);

  if (updateError) {
    console.error("[store-report] Update failed:", updateError.message);
  }

  // 4. Upsert metrics into portfolio_company_metrics (with normalization)
  await upsertNormalizedMetrics(analysis.companyId!, analysis.metrics, analysis.reportPeriod, report.id);

  console.log(`[store-report] Report ${report.id} completed`);

  // 5. Update latest_metrics on portfolio_companies for quick access
  if (Object.keys(analysis.metrics || {}).length > 0) {
    await supabase
      .from("portfolio_companies")
      .update({
        latest_metrics: analysis.metrics,
        latest_report_id: report.id,
      })
      .eq("id", analysis.companyId);
  }

  return {
    reportId: report.id,
    companyId: analysis.companyId,
    filesUploaded: stored.length,
  };
}

/**
 * Update an existing report with fresh analysis results.
 * Used by the reprocess pipeline to overwrite stale data.
 *
 * 1. DELETE existing report_files for this report
 * 2. UPDATE company_reports with new content + analysis
 * 3. Re-upload files via storeFiles (Storage upsert = safe)
 * 4. UPSERT metrics (already idempotent)
 */
export async function updateReport(
  reportId: string,
  analysis: ReportAnalysis,
  cleanedHtml: string | null,
  files: FileToStore[],
  rawContent: string | null,
  additionalContext?: string,
  emailMeta?: EmailMeta
): Promise<{ filesUploaded: number }> {
  if (!analysis.companyId) {
    throw new Error("[store-report] Cannot update report without company_id");
  }

  // 1. Delete existing report_files rows (storage upsert handles file overwrite)
  const { error: delError } = await supabase
    .from("report_files")
    .delete()
    .eq("report_id", reportId);

  if (delError) {
    console.error("[store-report] Delete report_files failed:", delError.message);
  }

  // 2. Update company_reports (désarchiver si nécessaire — un re-import signifie que le report est voulu)
  const { error: updateError } = await supabase
    .from("company_reports")
    .update({
      report_period: analysis.reportPeriod,
      report_type: analysis.reportType,
      headline: analysis.headline,
      key_highlights: analysis.keyHighlights,
      metrics: analysis.metrics,
      processing_status: "completed",
      processed_at: new Date().toISOString(),
      cleaned_content: cleanedHtml,
      raw_content: rawContent,
      report_date: analysis.reportDate,
      pipeline_version: PIPELINE_VERSION,
      reprocessed_at: new Date().toISOString(),
      is_archived: false,
      archive_reason: null,
      archived_at: null,
      archived_by: null,
      ...(additionalContext !== undefined && { additional_context: additionalContext }),
      ...(emailMeta && {
        email_from: emailMeta.from,
        sender_email: emailMeta.from,
        email_date: emailMeta.date || null,
        email_subject: emailMeta.subject,
      }),
    })
    .eq("id", reportId);

  if (updateError) {
    throw new Error(`[store-report] Update failed: ${updateError.message}`);
  }

  // 3. Re-upload files + insert report_files rows
  const stored = await storeFiles(
    files,
    reportId,
    analysis.companyId,
    analysis.reportPeriod
  );

  // 4. Upsert metrics (with normalization)
  await upsertNormalizedMetrics(analysis.companyId!, analysis.metrics, analysis.reportPeriod, reportId);

  // 5. Update latest_metrics on portfolio_companies
  if (Object.keys(analysis.metrics || {}).length > 0) {
    await supabase
      .from("portfolio_companies")
      .update({
        latest_metrics: analysis.metrics,
        latest_report_id: reportId,
      })
      .eq("id", analysis.companyId);
  }

  console.log(`[store-report] Report ${reportId} updated (reprocessed)`);
  return { filesUploaded: stored.length };
}

/**
 * Shared helper: normalize metric keys + upsert into portfolio_company_metrics.
 * Applies alias resolution, period extraction, and category detection.
 */
async function upsertNormalizedMetrics(
  companyId: string,
  metrics: Record<string, number> | undefined,
  reportPeriod: string,
  sourceReportId: string
): Promise<void> {
  const entries = Object.entries(metrics || {}).filter(([, v]) => v !== null && v !== undefined);
  if (entries.length === 0) return;

  const metricsToUpsert = entries.map(([key, value]) => {
    const normalized = normalizeMetricKey(key);
    // Use extracted period from key if report_period is missing, otherwise keep report_period
    const period = normalizePeriodDisplay(normalized.extractedPeriod || reportPeriod);
    const sortDate = parsePeriodToSortDate(period);
    return {
      company_id: companyId,
      metric_key: key,
      metric_value: String(value),
      metric_type: guessMetricType(key),
      report_period: period,
      source_report_id: sourceReportId,
      canonical_key: normalized.canonicalKey,
      metric_category: normalized.category,
      period_sort_date: sortDate?.toISOString().split("T")[0] || null,
    };
  });

  const { error } = await supabase
    .from("portfolio_company_metrics")
    .upsert(metricsToUpsert, {
      onConflict: "company_id,metric_key,report_period",
    });

  if (error) {
    console.error("[store-report] Metrics upsert failed:", error.message);
  } else {
    console.log(`[store-report] Upserted ${metricsToUpsert.length} metrics (normalized)`);
  }
}

function guessMetricType(key: string): string {
  const k = key.toLowerCase();
  if (k.includes("months") || k.includes("runway")) return "months";
  if (k.includes("rate") || k.includes("margin") || k.includes("churn")) return "percentage";
  if (k.includes("customers") || k.includes("employees") || k.includes("users")) return "number";
  return "currency";
}
