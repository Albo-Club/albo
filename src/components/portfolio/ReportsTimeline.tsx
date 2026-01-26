import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, ChevronDown, ChevronUp, Newspaper } from "lucide-react";
import { CompanyReport } from "@/hooks/useCompanyReports";
import { ReportSynthesisModal } from "./ReportSynthesisModal";

interface ReportsTimelineProps {
  reports: CompanyReport[];
  companyId: string;
}

export function ReportsTimeline({ reports, companyId }: ReportsTimelineProps) {
  // State pour gérer quelles cartes sont expandées (plusieurs possibles)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  
  // State pour la modal synthèse
  const [selectedReport, setSelectedReport] = useState<CompanyReport | null>(null);

  const toggleExpand = (reportId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(reportId)) {
        next.delete(reportId);
      } else {
        next.add(reportId);
      }
      return next;
    });
  };

  // Si aucun report
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
        {reports.map((report) => {
          const isExpanded = expandedIds.has(report.id);
          const hasHighlights = report.key_highlights && report.key_highlights.length > 0;
          
          return (
            <Card key={report.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-4 space-y-3">
                {/* Header: Date */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {report.report_period || "Report"}
                  </span>
                </div>
                
                {/* Headline en gras */}
                {report.headline && (
                  <p className="text-sm font-medium leading-relaxed text-foreground">
                    {report.headline}
                  </p>
                )}
                
                {/* Actions: boutons alignés à droite */}
                <div className="flex items-center justify-end gap-2">
                  {/* Bouton Synthèse - FileText + Sparkles dans le même bouton */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => setSelectedReport(report)}
                    disabled={!report.cleaned_content}
                    title="Voir la synthèse"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <Sparkles className="h-2.5 w-2.5 text-blue-500" />
                  </Button>
                  
                  {/* Bouton Expand/Collapse - seulement si key_highlights existe */}
                  {hasHighlights && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => toggleExpand(report.id)}
                      title={isExpanded ? "Masquer les highlights" : "Voir les highlights"}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
                
                {/* Key Highlights - Collapsible */}
                {isExpanded && hasHighlights && (
                  <div className="pt-2 border-t space-y-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Key Highlights
                    </span>
                    <div className="space-y-1">
                      {report.key_highlights!.map((highlight, idx) => (
                        <div
                          key={idx}
                          className="border-l-2 border-primary/50 pl-3 py-2 hover:border-primary hover:bg-muted/30 transition-all rounded-r-md"
                        >
                          <p className="text-xs text-foreground/85 leading-relaxed">
                            {highlight}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal Synthèse - Réutilise le composant existant */}
      <ReportSynthesisModal
        open={!!selectedReport}
        onOpenChange={(open) => !open && setSelectedReport(null)}
        reportPeriod={selectedReport?.report_period || null}
        content={selectedReport?.cleaned_content || null}
      />
    </>
  );
}
