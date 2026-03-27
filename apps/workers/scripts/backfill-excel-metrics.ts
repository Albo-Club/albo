/**
 * Backfill: Extract metrics from all existing xlsx report_files
 *
 * For each xlsx in report_files linked to a portfolio company:
 * 1. Download from Supabase Storage
 * 2. Extract text with extractExcel
 * 3. Extract metrics with Claude Haiku
 * 4. Upsert into portfolio_company_metrics with report_period
 *
 * Usage: npx tsx scripts/backfill-excel-metrics.ts [--dry-run]
 */

import "dotenv/config";
import { supabase } from "../src/lib/supabase";
import { extractExcel } from "../src/steps/extract-excel";
import { extractExcelMetrics } from "../src/steps/extract-excel-metrics";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`\n=== Backfill Excel Metrics ${DRY_RUN ? "(DRY RUN)" : ""} ===\n`);

  // 1. Get all xlsx report_files linked to a report with a company
  const { data: files, error } = await supabase
    .from("report_files")
    .select(`
      id, file_name, storage_path, report_id,
      company_reports!inner(id, company_id, report_period, report_date)
    `)
    .or("file_name.ilike.%.xlsx,file_name.ilike.%.xls,file_name.ilike.%.xlsm")
    .not("storage_path", "is", null);

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  console.log(`Found ${files.length} xlsx files to process\n`);

  let totalMetrics = 0;
  let processedFiles = 0;
  let failedFiles = 0;

  for (const file of files) {
    const report = file.company_reports as any;
    const companyId = report.company_id;
    const reportPeriod = report.report_period || "Unknown";
    const reportId = report.id;

    console.log(`--- ${file.file_name} (${reportPeriod}, company=${companyId}) ---`);

    // 2. Download from storage
    const { data: blob, error: dlError } = await supabase.storage
      .from("report-files")
      .download(file.storage_path);

    if (dlError || !blob) {
      console.error(`  Download failed: ${dlError?.message || "no data"}`);
      failedFiles++;
      continue;
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    console.log(`  Downloaded: ${(buffer.length / 1024).toFixed(0)}KB`);

    // 3. Extract text
    let extractedText: string;
    try {
      const result = extractExcel(buffer, file.file_name);
      extractedText = result.extractedText;
      console.log(`  Extracted: ${result.sheetCount} sheets, ${result.rowCount} rows`);
    } catch (err: any) {
      console.error(`  Excel extraction failed: ${err.message}`);
      failedFiles++;
      continue;
    }

    if (!extractedText || extractedText.length < 20) {
      console.log(`  Skipped: content too short (${extractedText?.length || 0} chars)`);
      continue;
    }

    // 4. Extract metrics via Claude Haiku
    let metrics;
    try {
      metrics = await extractExcelMetrics(extractedText, reportPeriod);
      console.log(`  Claude extracted: ${metrics.length} metrics`);
    } catch (err: any) {
      console.error(`  Claude extraction failed: ${err.message}`);
      failedFiles++;
      continue;
    }

    if (metrics.length === 0) {
      console.log(`  No metrics found`);
      continue;
    }

    // 5. Deduplicate + Upsert
    // Claude peut générer des doublons (même metric_key + report_period) → garder le dernier
    const deduped = new Map<string, typeof metrics[0]>();
    for (const m of metrics) {
      deduped.set(`${m.metric_key}|${m.report_period}`, m);
    }
    const uniqueMetrics = Array.from(deduped.values());

    if (!DRY_RUN) {
      const { error: upsertError } = await supabase
        .from("portfolio_company_metrics")
        .upsert(
          uniqueMetrics.map((m) => ({
            company_id: companyId,
            metric_key: m.metric_key,
            metric_value: m.metric_value,
            metric_type: m.metric_type,
            report_period: m.report_period,
            source_report_id: reportId,
          })),
          { onConflict: "company_id,metric_key,report_period" }
        );

      if (upsertError) {
        console.error(`  Upsert failed: ${upsertError.message}`);
        failedFiles++;
        continue;
      }
    }

    totalMetrics += uniqueMetrics.length;
    processedFiles++;
    console.log(`  ${DRY_RUN ? "Would upsert" : "Upserted"} ${metrics.length} metrics\n`);

    // Rate limit: wait 500ms between files to not hammer Claude
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n=== Done ===`);
  console.log(`Files: ${processedFiles} processed, ${failedFiles} failed, ${files.length - processedFiles - failedFiles} skipped`);
  console.log(`Metrics: ${totalMetrics} ${DRY_RUN ? "would be" : ""} upserted`);
}

main().catch(console.error);
