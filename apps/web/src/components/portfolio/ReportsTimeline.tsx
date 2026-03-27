import { useState, useMemo } from "react";
import { Newspaper, ChevronRight, Trash2 } from "lucide-react";
import { CompanyReport } from "@/hooks/useCompanyReports";
import { ReportContentViewer } from "./ReportContentViewer";
import { ArchiveReportDialog } from "./ArchiveReportDialog";
import { cn } from "@/lib/utils";
import { parseReportPeriodToSortDate, isPeriodRange } from "@/lib/reportPeriodParser";
import { format } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import { enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";

interface ReportsTimelineProps {
  reports: CompanyReport[];
  companyId: string;
  companyName?: string;
  onClickReport?: (report: CompanyReport) => void;
}

function getRelativeTime(dateString: string | null, t: (key: string, opts?: any) => string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "";
  if (diffDays === 0) return t('dates.today').toLowerCase();
  if (diffDays === 1) return t('dates.yesterday').toLowerCase();
  if (diffDays < 30) return `${diffDays}j`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return t('dates.monthsAgo', { count: diffMonths });
  const diffYears = Math.floor(diffMonths / 12);
  return t('dates.yearsAgo', { count: diffYears });
}

function formatReceptionDate(report: CompanyReport, lang: string): string {
  const raw = (report as any).email_date || report.report_date || report.created_at;
  if (!raw) return "";
  try {
    const locale = lang === "fr" ? frLocale : enUS;
    return format(new Date(raw), "d MMMM yyyy", { locale });
  } catch {
    return "";
  }
}

function getReceptionRaw(report: CompanyReport): string | null {
  return (report as any).email_date || report.report_date || report.created_at || null;
}

function formatPeriodLabel(period: string | null, lang: string): string {
  if (!period) return "—";
  if (lang === "fr") {
    return period
      .replace("January", "Janvier").replace("February", "Février")
      .replace("March", "Mars").replace("April", "Avril")
      .replace("May", "Mai").replace("June", "Juin")
      .replace("July", "Juillet").replace("August", "Août")
      .replace("September", "Septembre").replace("October", "Octobre")
      .replace("November", "Novembre").replace("December", "Décembre");
  }
  return period;
}

export function ReportsTimeline({ reports, companyId, companyName, onClickReport }: ReportsTimelineProps) {
  const [selectedReport, setSelectedReport] = useState<CompanyReport | null>(null);
  const [reportToArchive, setReportToArchive] = useState<CompanyReport | null>(null);
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("en") ? "en" : "fr";

  const sortedReports = useMemo(() => {
    if (!reports?.length) return [];
    return [...reports].sort((a, b) => {
      const periodDateA = parseReportPeriodToSortDate(a.report_period);
      const periodDateB = parseReportPeriodToSortDate(b.report_period);
      if (periodDateA.getTime() !== periodDateB.getTime()) {
        return periodDateB.getTime() - periodDateA.getTime();
      }
      const isRangeA = isPeriodRange(a.report_period);
      const isRangeB = isPeriodRange(b.report_period);
      if (isRangeA !== isRangeB) return isRangeA ? 1 : -1;
      const dateA = a.report_date ? new Date(a.report_date) : new Date(0);
      const dateB = b.report_date ? new Date(b.report_date) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [reports]);

  if (!reports || reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Newspaper className="h-10 w-10 text-muted-foreground/40 mb-4" />
        <p className="text-sm text-muted-foreground">
          {t('companyDetail.reports.noReports')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Newspaper className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-base font-semibold">{t('companyDetail.reports.title')}</h3>
        </div>

        {sortedReports.map((report) => {
          const receptionDate = formatReceptionDate(report, lang);
          const receptionRaw = getReceptionRaw(report);
          const relativeTime = getRelativeTime(receptionRaw, t);
          const headline = report.headline || "";
          const truncatedHeadline = headline.length > 150 ? headline.slice(0, 150) + "…" : headline;

          return (
            <div
              key={report.id}
              className={cn(
                "group relative rounded-lg border bg-card p-4 cursor-pointer transition-all",
                "hover:bg-accent/50 hover:shadow-sm hover:border-primary/20"
              )}
              onClick={() => onClickReport ? onClickReport(report) : setSelectedReport(report)}
            >
              <button
                className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                title={t('companyDetail.reports.archiveBtn')}
                onClick={(e) => {
                  e.stopPropagation();
                  setReportToArchive(report);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>

              {report.report_period && (
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  {t('companyDetail.reports.period')} : {formatPeriodLabel(report.report_period, lang)}
                </p>
              )}

              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 pr-6">
                  {truncatedHeadline ? (
                    <p className="text-sm text-foreground leading-relaxed">{truncatedHeadline}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">{t('companyDetail.reports.noSummary')}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
              </div>

              {receptionDate && (
                <div className="flex justify-end mt-2">
                  <span className="text-[10px] text-muted-foreground">
                    {t('companyDetail.reports.receivedOn')} {receptionDate}
                    {relativeTime && ` (${relativeTime})`}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ReportContentViewer
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        content={selectedReport?.cleaned_content || null}
        title={selectedReport?.report_period || t('companyDetail.reports.summary')}
        period={selectedReport?.report_period}
      />

      <ArchiveReportDialog
        isOpen={!!reportToArchive}
        onClose={() => setReportToArchive(null)}
        reportId={reportToArchive?.id || ""}
        reportPeriod={reportToArchive?.report_period || null}
        companyId={companyId}
      />
    </>
  );
}
