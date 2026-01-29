import { useState, useMemo } from "react";
import { Newspaper, FileText, Eye, ChevronDown, ChevronUp, Sparkles, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CompanyReport } from "@/hooks/useCompanyReports";
import { ReportSynthesisModal } from "./ReportSynthesisModal";
import { TextReportModal } from "./TextReportModal";
import { PdfPreviewModal } from "./PdfPreviewModal";
import { cn } from "@/lib/utils";

interface ReportsTimelineProps {
  reports: CompanyReport[];
  companyId: string;
  companyName?: string;
}

// Fonction pour calculer le temps relatif
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
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
  // State pour les cards expandées
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  
  // State pour les modals
  const [synthesisModal, setSynthesisModal] = useState<{ open: boolean; report: CompanyReport | null }>({ open: false, report: null });
  const [textModal, setTextModal] = useState<{ open: boolean; content: string | null; fileName: string | null; period: string | null }>({ open: false, content: null, fileName: null, period: null });
  const [pdfModal, setPdfModal] = useState<{ open: boolean; storagePath: string | null; fileName: string | null; period: string | null }>({ open: false, storagePath: null, fileName: null, period: null });

  // Trier les reports du plus récent au moins récent
  const sortedReports = useMemo(() => {
    if (!reports?.length) return [];
    return [...reports].sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [reports]);

  const toggleExpand = (reportId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
  };

  // Handler : clic sur le headline/card
  const handleCardClick = (report: CompanyReport) => {
    const mainFile = report.files[0];
    
    if (mainFile?.file_type === 'text') {
      // Type texte (email) -> afficher le cleaned_content dans TextReportModal
      setTextModal({
        open: true,
        content: report.cleaned_content,
        fileName: mainFile.original_file_name,
        period: report.report_period,
      });
    } else {
      // Type PDF -> afficher la synthèse
      setSynthesisModal({ open: true, report });
    }
  };

  // Handler : preview PDF
  const handlePreviewPdf = (report: CompanyReport, e: React.MouseEvent) => {
    e.stopPropagation();
    const pdfFile = report.files.find(f => f.mime_type === 'application/pdf');
    if (pdfFile) {
      setPdfModal({
        open: true,
        storagePath: pdfFile.storage_path,
        fileName: pdfFile.original_file_name || pdfFile.file_name,
        period: report.report_period,
      });
    }
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
      <div className="space-y-0">
        {sortedReports.map((report, index) => {
          const isExpanded = expandedIds.has(report.id);
          const hasHighlights = report.key_highlights && report.key_highlights.length > 0;
          const mainFile = report.files[0];
          const isTextReport = mainFile?.file_type === 'text';
          const isPdfReport = mainFile?.file_type === 'report' || mainFile?.mime_type === 'application/pdf';
          const isLast = index === sortedReports.length - 1;

          return (
            <div key={report.id} className="flex gap-4">
              {/* Colonne Timeline à gauche */}
              <div className="flex flex-col items-center w-28 shrink-0">
                {/* Période */}
                <span className="text-[11px] font-medium text-muted-foreground text-center leading-tight mb-2 px-1">
                  {formatPeriodShort(report.report_period)}
                </span>
                {/* Point sur la timeline */}
                <div 
                  className={cn(
                    "w-2.5 h-2.5 rounded-full shrink-0 z-10",
                    isTextReport ? "bg-blue-500" : "bg-primary"
                  )}
                />
                {/* Trait vertical */}
                {!isLast && (
                  <div className="w-px flex-1 bg-border mt-2" />
                )}
              </div>

              {/* Card du report */}
              <div className="flex-1 pb-4 min-w-0">
                <Card 
                  className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                  style={{ borderLeftColor: isTextReport ? 'hsl(var(--primary))' : 'hsl(217 91% 60%)' }}
                  onClick={() => handleCardClick(report)}
                >
                  <CardContent className="p-3">
                    {/* Header : temps relatif en haut à droite */}
                    <div className="flex justify-end mb-1">
                      <span className="text-[10px] text-muted-foreground/60">
                        {getRelativeTime(report.created_at)}
                      </span>
                    </div>
                    
                    {/* Headline - élément principal */}
                    {report.headline ? (
                      <p className="text-sm font-medium text-foreground leading-relaxed mb-3">
                        {report.headline}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic mb-3">
                        Aucun résumé disponible
                      </p>
                    )}

                    {/* Actions en bas */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                      {/* Icône type */}
                      {isTextReport ? (
                        <Mail className="h-3.5 w-3.5 text-blue-500" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-primary" />
                      )}
                      
                      {/* Preview PDF (seulement pour les PDF) */}
                      {isPdfReport && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs gap-1 px-2"
                          onClick={(e) => handlePreviewPdf(report, e)}
                        >
                          <Eye className="h-3 w-3" />
                          Preview
                        </Button>
                      )}
                      
                      {/* Synthèse AI */}
                      {report.cleaned_content && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs gap-1 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSynthesisModal({ open: true, report });
                          }}
                        >
                          <Sparkles className="h-3 w-3" />
                        </Button>
                      )}
                      
                      {/* Spacer */}
                      <div className="flex-1" />
                      
                      {/* Expand highlights */}
                      {hasHighlights && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(report.id);
                          }}
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                    </div>

                    {/* Key Highlights expandables */}
                    {isExpanded && hasHighlights && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          Key Highlights
                        </p>
                        <ul className="space-y-1.5">
                          {report.key_highlights!.map((highlight, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                              <p className="text-xs text-muted-foreground leading-relaxed">{highlight}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      <ReportSynthesisModal
        open={synthesisModal.open}
        onOpenChange={(open) => setSynthesisModal({ open, report: open ? synthesisModal.report : null })}
        reportPeriod={synthesisModal.report?.report_period || null}
        content={synthesisModal.report?.cleaned_content || null}
      />

      <TextReportModal
        open={textModal.open}
        onOpenChange={(open) => setTextModal({ ...textModal, open })}
        reportPeriod={textModal.period}
        content={textModal.content}
        originalFileName={textModal.fileName}
        companyName={companyName}
      />

      <PdfPreviewModal
        open={pdfModal.open}
        onOpenChange={(open) => setPdfModal({ ...pdfModal, open })}
        storagePath={pdfModal.storagePath}
        fileName={pdfModal.fileName}
        reportPeriod={pdfModal.period}
      />
    </>
  );
}
