import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import {
  FileText,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { PortfolioDocument } from '@/hooks/usePortfolioDocuments';

interface DocumentPreviewModalProps {
  document: PortfolioDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: (doc: PortfolioDocument) => void;
}

export function DocumentPreviewModal({
  document,
  open,
  onOpenChange,
  onDownload,
}: DocumentPreviewModalProps) {
  const [zoom, setZoom] = useState(100);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset zoom when document changes
  useEffect(() => {
    setZoom(100);
  }, [document?.id]);

  // Load file from storage
  useEffect(() => {
    if (!open || !document) {
      setFileUrl(null);
      setError(null);
      return;
    }

    // If it's a text file with content, no need to fetch
    if (document.text_content) {
      setFileUrl(null);
      setError(null);
      return;
    }

    if (!document.storage_path) {
      setError('Aucun fichier associé');
      return;
    }

    const loadFile = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Try portfolio-documents bucket first
        let { data, error: storageError } = await supabase.storage
          .from('portfolio-documents')
          .download(document.storage_path!);

        // If error, try report-files bucket
        if (storageError) {
          console.log('Trying report-files bucket for preview...');
          const result = await supabase.storage
            .from('report-files')
            .download(document.storage_path!);

          if (result.error) throw result.error;
          data = result.data;
        }

        if (!data) throw new Error('No data received');

        const url = URL.createObjectURL(data);
        setFileUrl(url);
      } catch (err) {
        console.error('Error loading file for preview:', err);
        setError('Impossible de charger le fichier');
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();

    // Cleanup URL on unmount or document change
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [open, document?.id, document?.storage_path, document?.text_content]);

  if (!document) return null;

  const isPdf = document.mime_type?.includes('pdf');
  const isImage = document.mime_type?.startsWith('image/');
  const isText = !!document.text_content || document.mime_type?.startsWith('text/');

  const handleZoomIn = () => setZoom((z) => Math.min(z + 25, 200));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 25, 50));
  const handleZoomReset = () => setZoom(100);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => onDownload(document)}>
            <Download className="h-4 w-4 mr-2" />
            Télécharger
          </Button>
        </div>
      );
    }

    // Text content (like Synthèse.txt)
    if (document.text_content) {
      return (
        <ScrollArea className="flex-1">
          <Card className="m-4 p-6 bg-muted/30">
            <pre
              className="whitespace-pre-wrap text-sm font-mono leading-relaxed"
              style={{ fontSize: `${zoom}%` }}
            >
              {document.text_content}
            </pre>
          </Card>
        </ScrollArea>
      );
    }

    // PDF
    if (isPdf && fileUrl) {
      return (
        <div className="flex-1 overflow-auto p-4">
          <iframe
            src={fileUrl}
            className="w-full h-full border-0 rounded-lg bg-white"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top left',
              width: `${10000 / zoom}%`,
              height: `${10000 / zoom}%`,
            }}
            title={document.name}
          />
        </div>
      );
    }

    // Image
    if (isImage && fileUrl) {
      return (
        <div className="flex-1 overflow-auto flex items-center justify-center p-4">
          <img
            src={fileUrl}
            alt={document.name}
            className="max-w-full max-h-full object-contain rounded-lg transition-transform duration-200"
            style={{ transform: `scale(${zoom / 100})` }}
          />
        </div>
      );
    }

    // Text file from storage
    if (isText && fileUrl) {
      return (
        <ScrollArea className="flex-1">
          <Card className="m-4 p-6 bg-muted/30">
            <iframe
              src={fileUrl}
              className="w-full min-h-[500px] border-0"
              style={{ fontSize: `${zoom}%` }}
              title={document.name}
            />
          </Card>
        </ScrollArea>
      );
    }

    // Unsupported format
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <p className="text-muted-foreground">Prévisualisation non disponible pour ce type de fichier</p>
        <Button onClick={() => onDownload(document)}>
          <Download className="h-4 w-4 mr-2" />
          Télécharger
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <DialogTitle className="text-base font-medium truncate max-w-[400px]">
                {document.name}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              {/* Zoom controls */}
              <div className="flex items-center gap-1 border rounded-lg px-2 py-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs w-12 text-center">{zoom}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomReset}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
              {/* Download button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(document)}
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
            </div>
          </div>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
