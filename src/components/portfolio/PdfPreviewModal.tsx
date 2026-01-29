import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface PdfPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storagePath: string | null;
  fileName: string | null;
  reportPeriod: string | null;
}

export function PdfPreviewModal({
  open,
  onOpenChange,
  storagePath,
  fileName,
  reportPeriod,
}: PdfPreviewModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && storagePath) {
      loadPdf();
    }
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
    };
  }, [open, storagePath]);

  const loadPdf = async () => {
    if (!storagePath) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('report-files')
        .download(storagePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      setPdfUrl(url);
    } catch (err) {
      console.error('Error loading PDF:', err);
      toast.error('Erreur lors du chargement du PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (pdfUrl && fileName) {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleOpenInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle className="text-lg font-semibold">
                {fileName || reportPeriod || "Document PDF"}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleOpenInNewTab} disabled={!pdfUrl}>
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Nouvel onglet
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!pdfUrl}>
                <Download className="h-4 w-4 mr-1.5" />
                Télécharger
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* PDF Viewer */}
        <div className="flex-1 min-h-0 bg-muted/30">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pdfUrl ? (
            <object
              data={pdfUrl}
              type="application/pdf"
              className="w-full h-full"
            >
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <p className="text-muted-foreground">Impossible d'afficher le PDF dans le navigateur</p>
                <Button onClick={handleOpenInNewTab}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ouvrir dans un nouvel onglet
                </Button>
              </div>
            </object>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Impossible de charger le PDF
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
