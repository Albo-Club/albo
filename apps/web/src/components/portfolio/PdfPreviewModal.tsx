import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { downloadFromPortfolioStorage } from "@/lib/portfolioStorage";

interface PdfPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storagePath: string | null;
  fileName: string | null;
  reportPeriod: string | null;
  bucket?: string;
}

export function PdfPreviewModal({
  open,
  onOpenChange,
  storagePath,
  fileName,
  reportPeriod,
  bucket,
}: PdfPreviewModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    let currentBlobUrl: string | null = null;

    const loadPdf = async () => {
      if (!open || !storagePath) {
        setPdfUrl(null);
        return;
      }

      setLoading(true);
      try {
        const { data } = await downloadFromPortfolioStorage(storagePath, bucket || 'report-files');
        const nextUrl = URL.createObjectURL(data);

        if (isCancelled) {
          URL.revokeObjectURL(nextUrl);
          return;
        }

        currentBlobUrl = nextUrl;
        setPdfUrl(nextUrl);
      } catch (err) {
        console.error('Error loading PDF:', err);
        if (!isCancelled) {
          setPdfUrl(null);
          toast.error('Erreur lors du chargement du PDF');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
      setLoading(false);
      setPdfUrl((previousUrl) => {
        if (previousUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(previousUrl);
        }
        return null;
      });
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [open, storagePath]);

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
      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
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

        <div className="flex-1 min-h-0 bg-muted/30">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pdfUrl ? (
            <div className="flex h-full flex-col overflow-hidden p-4">
              <object
                data={`${pdfUrl}#toolbar=1&navpanes=0`}
                type="application/pdf"
                className="h-full w-full rounded-lg border bg-background"
              >
                <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
                  <p className="text-center text-muted-foreground">Preview non disponible</p>
                  <Button onClick={handleDownload}>
                    <Download className="mr-2 h-4 w-4" />
                    Télécharger
                  </Button>
                </div>
              </object>
            </div>
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
