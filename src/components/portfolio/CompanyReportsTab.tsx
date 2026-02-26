import { useState } from "react";
import { FileText, Download, Eye, Loader2, Clock, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCompanyReports, CompanyReport } from "@/hooks/useCompanyReports";
import { ReportSynthesisModal } from "./ReportSynthesisModal";
import { UploadReportModal } from "./UploadReportModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CompanyReportsTabProps {
  companyId: string;
  companyName: string;
}

const downloadReportPdf = async (storagePath: string, fileName: string) => {
  try {
    const { data, error } = await supabase.storage
      .from('report-files')
      .download(storagePath);

    if (error) {
      console.error('Download error:', error);
      toast.error('Erreur lors du téléchargement');
      return;
    }

    // Create download link
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Téléchargement démarré');
  } catch (err) {
    console.error('Download error:', err);
    toast.error('Erreur lors du téléchargement');
  }
};

export function CompanyReportsTab({ companyId, companyName }: CompanyReportsTabProps) {
  const { data: reports, isLoading, error } = useCompanyReports(companyId);
  const [selectedReport, setSelectedReport] = useState<CompanyReport | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const handleDownload = async (report: CompanyReport) => {
    const pdfFile = report.files.find(f => f.mime_type === 'application/pdf');
    if (!pdfFile) {
      toast.error('Aucun fichier PDF disponible');
      return;
    }

    setDownloadingId(report.id);
    await downloadReportPdf(pdfFile.storage_path, pdfFile.file_name);
    setDownloadingId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Erreur lors du chargement des reports
      </div>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Aucun report disponible pour cette entreprise
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Reports</h3>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setUploadModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Ajouter un report
        </Button>
      </div>
      {reports.map((report) => {
        const hasPdf = report.files.some(f => f.mime_type === 'application/pdf');
        const isProcessing = report.processing_status !== 'completed';
        
        return (
          <Card key={report.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg">
                  <FileText className="h-6 w-6 text-primary" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">
                      {report.report_period || 'Report'}
                    </h3>
                    
                    {/* Report type badge */}
                    {report.report_type && (
                      <Badge 
                        variant="secondary"
                        className={
                          report.report_type === 'quarterly' 
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        }
                      >
                        {report.report_type === 'quarterly' ? 'Trimestriel' : 'Mensuel'}
                      </Badge>
                    )}

                    {/* Processing status */}
                    {isProcessing && (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        En cours
                      </Badge>
                    )}
                  </div>

                  {/* Headline */}
                  {report.headline && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {report.headline}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Download PDF */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(report)}
                    disabled={!hasPdf || downloadingId === report.id}
                    className="gap-1.5"
                  >
                    {downloadingId === report.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">PDF</span>
                  </Button>

                  {/* View synthesis */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedReport(report)}
                    disabled={!report.cleaned_content}
                    className="gap-1.5"
                  >
                    <Eye className="h-4 w-4" />
                    <span className="hidden sm:inline">Synthèse</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Synthesis Modal */}
      <ReportSynthesisModal
        open={!!selectedReport}
        onOpenChange={(open) => !open && setSelectedReport(null)}
        reportPeriod={selectedReport?.report_period || null}
        content={selectedReport?.cleaned_content || null}
      />
      {/* Upload Modal */}
      <UploadReportModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        companyId={companyId}
        companyName={companyName}
      />
    </div>
  );
}
