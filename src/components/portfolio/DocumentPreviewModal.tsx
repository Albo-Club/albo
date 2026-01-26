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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

// Helper to detect file type from name or mime
function getFileType(doc: PortfolioDocument): 'pdf' | 'image' | 'text' | 'word' | 'excel' | 'unknown' {
  const name = doc.name.toLowerCase();
  const mime = doc.mime_type?.toLowerCase() || '';

  // Check by extension first
  if (name.endsWith('.pdf') || mime.includes('pdf')) return 'pdf';
  if (name.endsWith('.doc') || name.endsWith('.docx') || 
      mime.includes('word') || mime.includes('officedocument.wordprocessing')) return 'word';
  if (name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv') ||
      mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return 'excel';
  if (name.endsWith('.txt') || mime.startsWith('text/') || doc.text_content) return 'text';
  if (name.match(/\.(jpg|jpeg|png|gif|webp)$/) || mime.startsWith('image/')) return 'image';

  return 'unknown';
}

export function DocumentPreviewModal({
  document,
  open,
  onOpenChange,
  onDownload,
}: DocumentPreviewModalProps) {
  const [zoom, setZoom] = useState(100);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wordHtml, setWordHtml] = useState<string | null>(null);
  const [excelData, setExcelData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  // Reset state when document changes
  useEffect(() => {
    setZoom(100);
    setWordHtml(null);
    setExcelData(null);
    setTextContent(null);
  }, [document?.id]);

  // Load file from storage
  useEffect(() => {
    if (!open || !document) {
      setFileUrl(null);
      setFileBlob(null);
      setError(null);
      setWordHtml(null);
      setExcelData(null);
      setTextContent(null);
      return;
    }

    // If it's a text file with content, no need to fetch
    if (document.text_content) {
      setTextContent(document.text_content);
      setFileUrl(null);
      setError(null);
      setIsLoading(false);
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
        let data: Blob | null = null;

        // Try portfolio-documents bucket first
        const result1 = await supabase.storage
          .from('portfolio-documents')
          .download(document.storage_path!);

        if (!result1.error && result1.data) {
          data = result1.data;
        } else {
          // Try report-files bucket
          console.log('Trying report-files bucket for preview...');
          const result2 = await supabase.storage
            .from('report-files')
            .download(document.storage_path!);

          if (!result2.error && result2.data) {
            data = result2.data;
          } else {
            // Try deck-files bucket
            console.log('Trying deck-files bucket for preview...');
            const result3 = await supabase.storage
              .from('deck-files')
              .download(document.storage_path!);

            if (result3.error) throw result3.error;
            data = result3.data;
          }
        }

        if (!data) throw new Error('No data received');

        setFileBlob(data);
        const fileType = getFileType(document);

        // Process based on file type
        if (fileType === 'word') {
          await processWordFile(data);
        } else if (fileType === 'excel') {
          await processExcelFile(data, document.name);
        } else if (fileType === 'text') {
          const text = await data.text();
          setTextContent(text);
        } else {
          // For PDF and images, create object URL
          const url = URL.createObjectURL(data);
          setFileUrl(url);
        }
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

  // Process Word document with mammoth
  const processWordFile = async (blob: Blob) => {
    try {
      const mammoth = await import('mammoth');
      const arrayBuffer = await blob.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setWordHtml(result.value);
    } catch (err) {
      console.error('Error processing Word file:', err);
      setError('Impossible de lire le fichier Word');
    }
  };

  // Process Excel/CSV file with xlsx
  const processExcelFile = async (blob: Blob, fileName: string) => {
    try {
      const XLSX = await import('xlsx');
      const arrayBuffer = await blob.arrayBuffer();
      
      let workbook;
      if (fileName.toLowerCase().endsWith('.csv')) {
        const text = await blob.text();
        workbook = XLSX.read(text, { type: 'string' });
      } else {
        workbook = XLSX.read(arrayBuffer, { type: 'array' });
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });

      if (jsonData.length > 0) {
        const headers = (jsonData[0] as string[]).map(h => String(h || ''));
        const rows = jsonData.slice(1).map(row => 
          (row as string[]).map(cell => String(cell ?? ''))
        );
        setExcelData({ headers, rows: rows.slice(0, 100) }); // Limit to 100 rows for preview
      }
    } catch (err) {
      console.error('Error processing Excel file:', err);
      setError('Impossible de lire le fichier Excel');
    }
  };

  if (!document) return null;

  const fileType = getFileType(document);
  const showZoomControls = fileType === 'image' || fileType === 'text';

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

    // Text content (like Synthèse.txt or .txt files)
    if (textContent || document.text_content) {
      return (
        <ScrollArea className="flex-1">
          <Card className="m-4 p-6 bg-muted/30">
            <pre
              className="whitespace-pre-wrap text-sm font-mono leading-relaxed"
              style={{ fontSize: `${zoom}%` }}
            >
              {textContent || document.text_content}
            </pre>
          </Card>
        </ScrollArea>
      );
    }

    // Word document
    if (fileType === 'word' && wordHtml) {
      return (
        <ScrollArea className="flex-1">
          <Card className="m-4 p-6 bg-white">
            <div 
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: wordHtml }}
            />
          </Card>
        </ScrollArea>
      );
    }

    // Excel/CSV
    if (fileType === 'excel' && excelData) {
      return (
        <ScrollArea className="flex-1">
          <div className="m-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    {excelData.headers.map((header, idx) => (
                      <TableHead key={idx} className="bg-muted text-xs font-medium">
                        {header || `Col ${idx + 1}`}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {excelData.rows.map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      {row.map((cell, cellIdx) => (
                        <TableCell key={cellIdx} className="text-xs py-2">
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {excelData.rows.length >= 100 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Affichage limité aux 100 premières lignes
              </p>
            )}
          </div>
        </ScrollArea>
      );
    }

    // PDF - use object with fallback for better compatibility
    if (fileType === 'pdf' && fileUrl) {
      return (
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          <object
            data={fileUrl}
            type="application/pdf"
            className="flex-1 w-full rounded-lg border bg-white"
            style={{
              minHeight: '100%',
            }}
          >
            {/* Fallback if object doesn't work */}
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <p className="text-muted-foreground text-center">
                La prévisualisation PDF n'est pas disponible dans votre navigateur.
              </p>
              <Button onClick={() => onDownload(document)}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger le PDF
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.open(fileUrl, '_blank')}
              >
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
            alt={document.name}
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
              {/* Zoom controls - only for PDF/images/text */}
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
