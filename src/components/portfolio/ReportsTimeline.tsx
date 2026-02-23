import { useState, useMemo } from "react";
import { Newspaper, ChevronRight, X, EyeOff, Undo2 } from "lucide-react";
import { CompanyReport } from "@/hooks/useCompanyReports";
import { ReportContentViewer } from "./ReportContentViewer";
import { cn } from "@/lib/utils";
import { parseReportPeriodToSortDate, isPeriodRange } from "@/lib/reportPeriodParser";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ReportsTimelineProps {
  reports: CompanyReport[];
  companyId: string;
  companyName?: string;
}

// Fonction pour calculer le temps écoulé depuis report_date
function getRelativeTime(dateString: string | null): string {
  if (!dateString) return "";
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return "";
  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return "hier";
  if (diffDays < 30) return `${diffDays}j`;
  
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} mois`;
  
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} an${diffYears > 1 ? 's' : ''}`;
}

function formatReceptionDate(report: CompanyReport): string {
  const raw = (report as any).email_date || report.report_date || report.created_at;
  if (!raw) return "";
  try {
    return format(new Date(raw), "d MMMM yyyy", { locale: fr });
  } catch {
    return "";
  }
}

function getReceptionRaw(report: CompanyReport): string | null {
  return (report as any).email_date || report.report_date || report.created_at || null;
}

// Fonction pour formater la période
function formatPeriodLabel(period: string | null): string {
  if (!period) return "—";
  return period
    .replace("January", "Janvier")
    .replace("February", "Février")
    .replace("March", "Mars")
    .replace("April", "Avril")
    .replace("May", "Mai")
    .replace("June", "Juin")
    .replace("July", "Juillet")
    .replace("August", "Août")
    .replace("September", "Septembre")
    .replace("October", "Octobre")
    .replace("November", "Novembre")
    .replace("December", "Décembre");
}

export function ReportsTimeline({ reports, companyId, companyName }: ReportsTimelineProps) {
  const [selectedReport, setSelectedReport] = useState<CompanyReport | null>(null);
  const [hiddenReportIds, setHiddenReportIds] = useState<Set<string>>(new Set());

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

  const visibleReports = useMemo(() => {
    return sortedReports.filter(r => !hiddenReportIds.has(r.id));
  }, [sortedReports, hiddenReportIds]);

  const hideReport = (id: string) => {
    setHiddenReportIds(prev => new Set(prev).add(id));
  };

  const restoreAll = () => {
    setHiddenReportIds(new Set());
  };

  const handleCardClick = (report: CompanyReport) => {
    setSelectedReport(report);
  };

  if (!reports || reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Newspaper className="h-10 w-10 text-muted-foreground/40 mb-4" />
        <p className="text-sm text-muted-foreground">
          Aucun report reçu pour cette entreprise.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Section title */}
        <div className="flex items-center gap-2 mb-2">
          <Newspaper className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-base font-semibold">Historique des Reports</h3>
        </div>

        {hiddenReportIds.size > 0 && (
          <div className="flex items-center justify-between bg-muted/50 border border-dashed border-border rounded-lg px-4 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <EyeOff className="h-3.5 w-3.5" />
              <span>{hiddenReportIds.size} report{hiddenReportIds.size > 1 ? 's' : ''} masqué{hiddenReportIds.size > 1 ? 's' : ''}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={restoreAll} className="gap-1.5">
              <Undo2 className="h-3.5 w-3.5" />
              Tout réafficher
            </Button>
          </div>
        )}

        {visibleReports.map((report) => {
          const receptionDate = formatReceptionDate(report);
          const receptionRaw = getReceptionRaw(report);
          const relativeTime = getRelativeTime(receptionRaw);
          const headline = report.headline || "";
          const truncatedHeadline = headline.length > 150 ? headline.slice(0, 150) + "…" : headline;

          return (
            <div
              key={report.id}
              className={cn(
                "group relative rounded-lg border bg-card p-4 cursor-pointer transition-all",
                "hover:bg-accent/50 hover:shadow-sm hover:border-primary/20"
              )}
              onClick={() => handleCardClick(report)}
            >
              {/* Hide button */}
              <button
                className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                title="Masquer ce report (doublon)"
                onClick={(e) => {
                  e.stopPropagation();
                  hideReport(report.id);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {/* Period label */}
              {report.report_period && (
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  Période : {formatPeriodLabel(report.report_period)}
                </p>
              )}

              {/* Headline + Chevron */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 pr-6">
                  {truncatedHeadline ? (
                    <p className="text-sm text-foreground leading-relaxed">
                      {truncatedHeadline}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Aucun résumé disponible
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
              </div>

              {/* Reception date + relative time */}
              {receptionDate && (
                <div className="flex justify-end mt-2">
                  <span className="text-[10px] text-muted-foreground">
                    Reçu le {receptionDate}
                    {relativeTime && ` (${relativeTime})`}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Report content viewer */}
      <ReportContentViewer
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        content={selectedReport?.cleaned_content || null}
        title={selectedReport?.report_period || "Synthèse"}
        period={selectedReport?.report_period}
      />
    </>
  );
}
