/**
 * Step: Reprocess a report from its files already in Supabase Storage.
 *
 * 1. Query report_files → get storage_path + file metadata
 * 2. Download each file from Supabase Storage
 * 3. Route by extension: PDF → extractPdf, Excel → extractExcel, Image → extractImage
 * 4. Combine extracted text as ocrContent
 * 5. Query company_reports for metadata (company_id, subject, etc.)
 * 6. Analyze with Claude → validate → updateReport
 */

import { supabase } from "../lib/supabase";
import { extractPdf } from "./extract-pdf";
import { extractExcel } from "./extract-excel";
import { extractImage } from "./extract-image";
import { analyzeReport } from "./analyze-report";
import { validateResult } from "./validate-result";
import { updateReport } from "./store-report";
import type { FileToStore } from "./store-files";

export interface ReprocessResult {
  success: boolean;
  reportId: string;
  metricsCount: number;
  rawContentLength: number;
  error?: string;
}

export async function reprocessFromStorage(reportId: string): Promise<ReprocessResult> {
  // 1. Fetch report metadata (including cleaned_content for email text)
  const { data: report, error: reportErr } = await supabase
    .from("company_reports")
    .select("id, company_id, email_subject, email_from, email_date, report_period, cleaned_content, raw_content")
    .eq("id", reportId)
    .single();

  if (reportErr || !report) {
    throw new Error(`[reprocess] Report ${reportId} not found: ${reportErr?.message}`);
  }

  if (!report.company_id) {
    return { success: false, reportId, metricsCount: 0, rawContentLength: 0, error: "No company_id" };
  }

  // 2. Fetch report_files
  const { data: files, error: filesErr } = await supabase
    .from("report_files")
    .select("id, storage_path, file_name, mime_type, file_type")
    .eq("report_id", reportId);

  if (filesErr) {
    throw new Error(`[reprocess] Failed to fetch files: ${filesErr.message}`);
  }

  if (!files || files.length === 0) {
    return { success: false, reportId, metricsCount: 0, rawContentLength: 0, error: "No files in storage" };
  }

  // 3. Download + extract each file
  // Process "report" files first; fall back to inline_images if no report files exist
  const reportFiles = files.filter((f) => f.file_type !== "inline_image");
  const filesToProcess = reportFiles.length > 0 ? reportFiles : files;

  const ocrParts: string[] = [];
  const filesToStore: FileToStore[] = [];

  for (const file of filesToProcess) {

    const { data: blob, error: dlErr } = await supabase.storage
      .from("report-files")
      .download(file.storage_path);

    if (dlErr || !blob) {
      console.error(`[reprocess] Download failed ${file.storage_path}: ${dlErr?.message}`);
      continue;
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const ext = file.file_name?.split(".").pop()?.toLowerCase() || "";
    let extractedText = "";

    try {
      if (ext === "pdf" || file.mime_type === "application/pdf") {
        extractedText = await extractPdf(buffer, file.file_name);
      } else if (["xlsx", "xls", "xlsm"].includes(ext)) {
        const result = extractExcel(buffer, file.file_name);
        extractedText = result.llmPrompt || result.extractedText;
      } else if (file.mime_type?.startsWith("image/")) {
        extractedText = await extractImage(buffer, file.mime_type, file.file_name);
      }
    } catch (err: any) {
      console.error(`[reprocess] Extraction failed for ${file.file_name}: ${err.message}`);
    }

    if (extractedText) ocrParts.push(extractedText);

    filesToStore.push({
      buffer,
      name: file.file_name || "file",
      extension: ext,
      mime: file.mime_type || "application/octet-stream",
      size: buffer.length,
      extractedText: extractedText || undefined,
    });
  }

  const ocrContent = ocrParts.length > 0 ? ocrParts.join("\n\n---\n\n") : null;

  if (!ocrContent) {
    return { success: false, reportId, metricsCount: 0, rawContentLength: 0, error: "No extractable content" };
  }

  // 4. Analyze with Claude
  const company = {
    found: true as const,
    companyId: report.company_id,
    companyName: null as string | null,
    workspaceId: null as string | null,
    domain: null,
    matchedBy: "reprocess" as const,
    profileId: null,
  };

  // Fetch company name for better analysis
  const { data: companyData } = await supabase
    .from("portfolio_companies")
    .select("name, workspace_id")
    .eq("id", report.company_id)
    .single();

  if (companyData) {
    company.companyName = companyData.name;
    company.workspaceId = companyData.workspace_id;
  }

  // Use existing email text content for analysis (email body often contains KPIs like AuM)
  // Strip HTML tags from cleaned_content to get plain text
  const emailText = report.cleaned_content
    ? report.cleaned_content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    : "";

  const analysis = await analyzeReport(
    emailText,
    ocrContent,
    company,
    report.email_subject || "",
    report.email_from || "",
    report.email_date || new Date().toISOString()
  );

  // 5. Validate
  const validated = validateResult(analysis);

  // Force company_id to the original (don't let Claude redirect on reprocess)
  validated.companyId = report.company_id;
  validated.companyName = company.companyName;
  validated.workspaceId = company.workspaceId;

  // 6. Update report (preserve existing cleaned_content — don't overwrite with null)
  await updateReport(reportId, validated, report.cleaned_content || null, filesToStore, ocrContent);

  return {
    success: true,
    reportId,
    metricsCount: Object.keys(validated.metrics || {}).length,
    rawContentLength: ocrContent.length,
  };
}
