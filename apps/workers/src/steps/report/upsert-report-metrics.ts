/**
 * Step: Upsert Report Metrics
 * Merge regex metrics (Excel) + Claude Haiku metrics, normalise, upsert en DB.
 */

import { logger } from "@trigger.dev/sdk";
import { supabase } from "../../lib/supabase.js";
import { extractDocumentMetrics } from "../extract-excel-metrics.js";
import { normalizeMetricsForDb } from "../../lib/metric-aliases.js";
import type { ExcelMetric } from "../extract-excel.js";

export async function upsertReportMetrics(
  companyId: string,
  reportId: string,
  reportPeriod: string,
  excelMetrics: ExcelMetric[],
  allExcelTexts: string[]
): Promise<void> {
  if (allExcelTexts.length === 0) return;

  try {
    const combinedExcelText = allExcelTexts.join("\n\n");
    const claudeMetrics = await extractDocumentMetrics(
      combinedExcelText,
      reportPeriod || new Date().toISOString().slice(0, 7)
    );

    // Merge regex + Claude, dédupliquer
    const allMetrics = [...excelMetrics];
    const existingKeys = new Set(
      excelMetrics.map((m) => `${m.metric_key}|${m.report_period}`)
    );
    for (const cm of claudeMetrics) {
      if (!existingKeys.has(`${cm.metric_key}|${cm.report_period}`)) {
        allMetrics.push(cm);
      }
    }

    // Normaliser : clés canoniques + enrichir périodes avec année
    const period = reportPeriod || new Date().toISOString().slice(0, 7);
    const normalizedMetrics = normalizeMetricsForDb(allMetrics, period);

    if (normalizedMetrics.length === 0) return;

    const { error: metricsError } = await supabase
      .from("portfolio_company_metrics")
      .upsert(
        normalizedMetrics.map((m) => ({
          company_id: companyId,
          metric_key: m.metric_key,
          metric_value: m.metric_value,
          metric_type: m.metric_type,
          report_period: m.report_period,
          canonical_key: m.canonical_key,
          metric_category: m.metric_category,
          period_sort_date: m.period_sort_date,
          source_report_id: reportId,
          source: "report",
        })),
        { onConflict: "company_id,metric_key,report_period" }
      );

    if (metricsError) {
      logger.error("Excel metrics upsert failed", { error: metricsError.message });
    } else {
      logger.info(
        `Upserted ${normalizedMetrics.length} normalized metrics (${allMetrics.length} raw, ${claudeMetrics.length} via Claude)`
      );
    }
  } catch (err: any) {
    logger.error("Excel metrics extraction error", { error: err.message });
  }
}
