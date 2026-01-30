import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { DealDocument } from '@/hooks/useDealDocuments';

interface DealDocumentPreviewModalProps {
  document: DealDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: (doc: DealDocument) => void;
  onOpenInNewTab: (doc: DealDocument) => void;
}

function getFileType(doc: DealDocument): 'pdf' | 'image' | 'unknown' {
  const name = doc.file_name.toLowerCase();
  const mime = doc.mime_type?.toLowerCase() || '';

  if (name.endsWith('.pdf') || mime.includes('pdf')) return 'pdf';
  if (name.match(/\.(jpg|jpeg|png|gif|webp)$/) || mime.startsWith('image/')) return 'image';

  return 'unknown';
}

export function DealDocumentPreviewModal({
  document,
  open,
  onOpenChange,
  onDownload,
  onOpenInNewTab,
}: DealDocumentPreviewModalProps) {
  const [zoom, setZoom] = useState(100);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when document changes
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

    const loadFile = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let blob: Blob;

        if (document.storage_path) {
          const { data, error: downloadError } = await supabase.storage
            .from('deck-files')
            .download(document.storage_path);

          if (downloadError) throw downloadError;
          if (!data) throw new Error('No data received');
          blob = data;
        } else if (document.base64_content) {
          const binaryString = atob(document.base64_content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: document.mime_type || 'application/pdf' });
        } else {
          throw new Error('No file content available');
        }

        const url = URL.createObjectURL(blob);
        setFileUrl(url);
      } catch (err) {
        console.error('Error loading file for preview:', err);
        setError('Impossible de charger le fichier');
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();

    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [open, document?.id, document?.storage_path, document?.base64_content]);

  if (!document) return null;

  const fileType = getFileType(document);
  const showZoomControls = fileType === 'image';

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

    // PDF
    if (fileType === 'pdf' && fileUrl) {
      return (
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          <object
            data={fileUrl}
            type="application/pdf"
            className="flex-1 w-full rounded-lg border bg-white"
            style={{ minHeight: '100%' }}
          >
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <p className="text-muted-foreground text-center">
                La prévisualisation PDF n'est pas disponible dans votre navigateur.
              </p>
              <Button onClick={() => onDownload(document)}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger le PDF
              </Button>
              <Button variant="outline" onClick={() => onOpenInNewTab(document)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Ouvrir dans un nouvel onglet
              </Button>
            </div>
          </object>
        </div>
      );
    }

    // Image
    if (fileType === 'image' && fileUrl) {
      return (
        <div className="flex-1 overflow-auto flex items-center justify-center p-4">
          <img
            src={fileUrl}
            alt={document.file_name}
            className="max-w-full max-h-full object-contain rounded-lg transition-transform duration-200"
            style={{ transform: `scale(${zoom / 100})` }}
          />
        </div>
      );
    }

    // Unsupported format
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <p className="text-muted-foreground">Prévisualisation non disponible pour ce format</p>
        <Button onClick={() => onDownload(document)}>
          <Download className="h-4 w-4 mr-2" />
          Télécharger
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 [&>button]:hidden">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <DialogTitle className="text-base font-medium truncate max-w-[400px]">
                {document.file_name}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              {/* Zoom controls for images */}
              {showZoomControls && (
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
              )}
              {/* Open in new tab */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenInNewTab(document)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Nouvel onglet
              </Button>
              {/* Download button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(document)}
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
