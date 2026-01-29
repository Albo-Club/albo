import { useState, useMemo } from "react";
import { Newspaper } from "lucide-react";
import { CompanyReport } from "@/hooks/useCompanyReports";
import { ReportSynthesisModal } from "./ReportSynthesisModal";
import { cn } from "@/lib/utils";

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

  // Trier les reports par report_date DESC (plus récent en haut)
  const sortedReports = useMemo(() => {
    if (!reports?.length) return [];
    return [...reports].sort((a, b) => {
      const dateA = a.report_date ? new Date(a.report_date) : new Date(0);
      const dateB = b.report_date ? new Date(b.report_date) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [reports]);

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
        {sortedReports.map((report) => {
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
                {/* Temps écoulé EN DEHORS de la card, en haut à droite */}
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
                    "rounded-lg border bg-card p-4 cursor-pointer transition-colors",
                    "hover:bg-accent/50"
                  )}
                  onClick={() => handleCardClick(report)}
                >
                  {/* Headline en gras */}
                  {report.headline ? (
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      {report.headline}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Aucun résumé disponible
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal pour afficher le cleaned_content en markdown */}
      <ReportSynthesisModal
        open={!!selectedReport}
        onOpenChange={(open) => !open && setSelectedReport(null)}
        reportPeriod={selectedReport?.report_period || null}
        content={selectedReport?.cleaned_content || null}
      />
    </>
  );
}
