/**
 * Trigger.dev Task: Report Audit
 *
 * Scan all reports, score their quality, produce a summary.
 * Read-only — no mutations. The user decides what to reprocess.
 */

import { task, logger, metadata } from "@trigger.dev/sdk";
import { supabase } from "../lib/supabase.js";
import { PIPELINE_VERSION } from "../lib/pipeline-version.js";

type Issue = "no_raw_content" | "no_metrics" | "no_files" | "files_missing_ocr" | "outdated_version" | "had_errors";
type Strategy = "from-storage" | "from-email" | "not-reprocessable";

interface AuditEntry {
  reportId: string;
  companyName: string | null;
  reportPeriod: string | null;
  issues: Issue[];
  strategy: Strategy;
  fileCount: number;
  hasEmailMessageId: boolean;
}

interface AuditSummary {
  totalReports: number;
  reportsWithIssues: number;
  issueBreakdown: Record<Issue, number>;
  strategyBreakdown: Record<Strategy, number>;
  entries: AuditEntry[];
}

export const reportAuditTask = task({
  id: "report-audit",
  queue: { concurrencyLimit: 1 },
  retry: { maxAttempts: 1 },
  run: async (): Promise<AuditSummary> => {
    logger.info("Starting report audit");

    // 1. Fetch all reports
    const { data: reports, error: reportsErr } = await supabase
      .from("company_reports")
      .select("id, company_id, raw_content, metrics, pipeline_version, email_message_id, report_period")
      .order("created_at", { ascending: false });

    if (reportsErr) throw new Error(`Failed to fetch reports: ${reportsErr.message}`);
    if (!reports || reports.length === 0) {
      return { totalReports: 0, reportsWithIssues: 0, issueBreakdown: {} as any, strategyBreakdown: {} as any, entries: [] };
    }

    logger.info(`Scanning ${reports.length} reports`);
    metadata.set("totalReports", reports.length);

    // 2. Fetch all report_files grouped by report_id
    const { data: allFiles, error: filesErr } = await supabase
      .from("report_files")
      .select("report_id, original_text_report");

    if (filesErr) throw new Error(`Failed to fetch files: ${filesErr.message}`);

    const filesByReport = new Map<string, { count: number; missingOcr: number }>();
    for (const f of allFiles || []) {
      const entry = filesByReport.get(f.report_id) || { count: 0, missingOcr: 0 };
      entry.count++;
      if (!f.original_text_report) entry.missingOcr++;
      filesByReport.set(f.report_id, entry);
    }

    // 3. Fetch company names for display
    const companyIds = [...new Set(reports.map((r) => r.company_id).filter(Boolean))];
    const { data: companies } = await supabase
      .from("portfolio_companies")
      .select("id, name")
      .in("id", companyIds);

    const companyNames = new Map<string, string>();
    for (const c of companies || []) companyNames.set(c.id, c.name);

    // 4. Check for pipeline errors
    const { data: errorLogs } = await supabase
      .from("pipeline_logs")
      .select("run_id")
      .eq("level", "error")
      .eq("pipeline", "report");

    const runsWithErrors = new Set((errorLogs || []).map((l) => l.run_id));

    // 5. Score each report
    const issueBreakdown: Record<Issue, number> = {
      no_raw_content: 0,
      no_metrics: 0,
      no_files: 0,
      files_missing_ocr: 0,
      outdated_version: 0,
      had_errors: 0,
    };
    const strategyBreakdown: Record<Strategy, number> = {
      "from-storage": 0,
      "from-email": 0,
      "not-reprocessable": 0,
    };

    const entries: AuditEntry[] = [];

    for (const report of reports) {
      const issues: Issue[] = [];
      const fileInfo = filesByReport.get(report.id);

      if (!report.raw_content) issues.push("no_raw_content");

      const metricsEmpty = !report.metrics || (typeof report.metrics === "object" && Object.keys(report.metrics).length === 0);
      if (metricsEmpty) issues.push("no_metrics");

      if (!fileInfo || fileInfo.count === 0) issues.push("no_files");
      if (fileInfo && fileInfo.missingOcr > 0) issues.push("files_missing_ocr");

      if (!report.pipeline_version || report.pipeline_version < PIPELINE_VERSION) {
        issues.push("outdated_version");
      }

      // Note: we can't match run_id to report_id directly from pipeline_logs
      // This check is best-effort — skip if no run_id linkage

      if (issues.length === 0) continue;

      // Determine strategy
      let strategy: Strategy;
      if (fileInfo && fileInfo.count > 0) {
        strategy = "from-storage";
      } else if (report.email_message_id) {
        strategy = "from-email";
      } else {
        strategy = "not-reprocessable";
      }

      for (const issue of issues) issueBreakdown[issue]++;
      strategyBreakdown[strategy]++;

      entries.push({
        reportId: report.id,
        companyName: report.company_id ? companyNames.get(report.company_id) || null : null,
        reportPeriod: report.report_period,
        issues,
        strategy,
        fileCount: fileInfo?.count || 0,
        hasEmailMessageId: !!report.email_message_id,
      });
    }

    const summary: AuditSummary = {
      totalReports: reports.length,
      reportsWithIssues: entries.length,
      issueBreakdown,
      strategyBreakdown,
      entries,
    };

    metadata.set("reportsWithIssues", entries.length);
    metadata.set("issueBreakdown", issueBreakdown);
    metadata.set("strategyBreakdown", strategyBreakdown);

    logger.info(`Audit complete: ${entries.length}/${reports.length} reports with issues`, {
      issueBreakdown,
      strategyBreakdown,
    });

    return summary;
  },
});
