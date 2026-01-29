import { useState, useMemo } from "react";
import { Newspaper } from "lucide-react";
import { CompanyReport } from "@/hooks/useCompanyReports";
import { ReportTimelineItem } from "./ReportTimelineItem";
import { ReportSynthesisModal } from "./ReportSynthesisModal";
import { TextReportModal } from "./TextReportModal";
import { PdfPreviewModal } from "./PdfPreviewModal";

interface ReportsTimelineProps {
  reports: CompanyReport[];
  companyId: string;
  companyName?: string;
}

export function ReportsTimeline({ reports, companyId, companyName }: ReportsTimelineProps) {
  // Modals state
  const [synthesisModal, setSynthesisModal] = useState<{
    open: boolean;
    report: CompanyReport | null;
  }>({ open: false, report: null });
  
  const [textModal, setTextModal] = useState<{
    open: boolean;
    content: string | null;
    period: string | null;
    fileName: string | null;
  }>({ open: false, content: null, period: null, fileName: null });
  
  const [pdfModal, setPdfModal] = useState<{
    open: boolean;
    storagePath: string | null;
    fileName: string | null;
    period: string | null;
  }>({ open: false, storagePath: null, fileName: null, period: null });

  // Grouper les reports par année/mois pour l'affichage
  const groupedReports = useMemo(() => {
    if (!reports?.length) return [];
    
    // Trier par date décroissante
    return [...reports].sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [reports]);

  // Handler : clic sur le headline
  const handleClickHeadline = (report: CompanyReport) => {
    const mainFile = report.files[0];
    
    if (mainFile?.file_type === 'text') {
      // Report de type texte (email) -> afficher le cleaned_content
      setTextModal({
        open: true,
        content: report.cleaned_content,
        period: report.report_period,
        fileName: mainFile.original_file_name,
      });
    } else {
      // Report de type PDF -> afficher la synthèse
      setSynthesisModal({
        open: true,
        report,
      });
    }
  };

  // Handler : preview PDF
  const handlePreviewPdf = (report: CompanyReport) => {
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

  // Aucun report
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
      {/* Timeline */}
      <div className="space-y-0">
        {groupedReports.map((report, index) => (
          <ReportTimelineItem
            key={report.id}
            report={report}
            onClickHeadline={handleClickHeadline}
            onPreviewPdf={handlePreviewPdf}
            isLast={index === groupedReports.length - 1}
          />
        ))}
      </div>

      {/* Modal Synthèse (pour PDF) */}
      <ReportSynthesisModal
        open={synthesisModal.open}
        onOpenChange={(open) => setSynthesisModal({ open, report: open ? synthesisModal.report : null })}
        reportPeriod={synthesisModal.report?.report_period || null}
        content={synthesisModal.report?.cleaned_content || null}
      />

      {/* Modal Texte (pour email) */}
      <TextReportModal
        open={textModal.open}
        onOpenChange={(open) => setTextModal({ ...textModal, open })}
        reportPeriod={textModal.period}
        content={textModal.content}
        originalFileName={textModal.fileName}
        companyName={companyName}
      />

      {/* Modal Preview PDF */}
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
