import { useState, useMemo } from "react";
import { Newspaper, ChevronRight, X, EyeOff, Undo2 } from "lucide-react";
import { CompanyReport } from "@/hooks/useCompanyReports";
import { ReportContentViewer } from "./ReportContentViewer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  
  if (diffDays < 0) return ""; // Date future
  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return "hier";
  if (diffDays < 30) return `${diffDays}j`;
  
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} mois`;
  
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} an${diffYears > 1 ? 's' : ''}`;
}

// Fonction pour formater la période en version courte
function formatPeriodShort(period: string | null): string {
  if (!period) return "—";
  return period
    .replace("January", "Jan")
    .replace("February", "Fév")
    .replace("March", "Mar")
    .replace("April", "Avr")
    .replace("May", "Mai")
    .replace("June", "Juin")
    .replace("July", "Juil")
    .replace("August", "Août")
    .replace("September", "Sep")
    .replace("October", "Oct")
    .replace("November", "Nov")
    .replace("December", "Déc");
}

export function ReportsTimeline({ reports, companyId, companyName }: ReportsTimelineProps) {
  // State pour le modal
  const [selectedReport, setSelectedReport] = useState<CompanyReport | null>(null);
  const [hiddenReportIds, setHiddenReportIds] = useState<Set<string>>(new Set());

  // Trier les reports par report_date DESC
  const sortedReports = useMemo(() => {
    if (!reports?.length) return [];
    return [...reports].sort((a, b) => {
      const dateA = a.report_date ? new Date(a.report_date) : new Date(0);
      const dateB = b.report_date ? new Date(b.report_date) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [reports]);

  // Filtrer les reports masqués
  const visibleReports = useMemo(() => {
    return sortedReports.filter(r => !hiddenReportIds.has(r.id));
  }, [sortedReports, hiddenReportIds]);

  const hideReport = (id: string) => {
    setHiddenReportIds(prev => new Set(prev).add(id));
  };

  const restoreAll = () => {
    setHiddenReportIds(new Set());
  };

  // Handler : clic sur la card → ouvre le cleaned_content en markdown
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
      <div className="space-y-4">
        {hiddenReportIds.size > 0 && (
          <div className="flex items-center justify-between bg-muted/50 border border-dashed border-border rounded-lg px-4 py-2 mb-4">
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
          const relativeTime = getRelativeTime(report.report_date);

          return (
            <div key={report.id} className="flex gap-4">
              {/* Colonne Timeline à gauche */}
              <div className="flex flex-col items-center w-28 shrink-0">
                <span className="text-[11px] font-medium text-muted-foreground text-center leading-tight px-1">
                  {formatPeriodShort(report.report_period)}
                </span>
              </div>

              {/* Colonne droite : temps + card */}
              <div className="flex-1 min-w-0">
                {relativeTime && (
                  <div className="flex justify-end mb-1">
                    <span className="text-[10px] text-muted-foreground/60">
                      {relativeTime}
                    </span>
                  </div>
                )}
                
                {/* Card du report */}
                <div 
                  className={cn(
                    "group relative rounded-lg border bg-card p-4 cursor-pointer transition-all",
                    "hover:bg-accent/50 hover:shadow-sm hover:border-primary/20"
                  )}
                  onClick={() => handleCardClick(report)}
                >
                  {/* Bouton masquer */}
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

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {report.headline ? (
                        <p className="text-sm font-medium text-foreground leading-relaxed pr-6">
                          {report.headline}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic pr-6">
                          Aucun résumé disponible
                        </p>
                      )}
                    </div>
                    
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sheet pour afficher le cleaned_content (HTML ou Markdown) */}
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
