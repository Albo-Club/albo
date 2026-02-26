import { useState, useCallback, useRef } from 'react';
import { X, Upload, Loader2, CheckCircle2, XCircle, FileSpreadsheet, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface ImportPortfolioModalProps {
  open: boolean;
  onClose: () => void;
}

interface ImportResult {
  success: boolean;
  company_name: string;
  error?: string;
}

interface ImportResponse {
  success: boolean;
  async?: boolean;
  jobId?: string;
  totalRows?: number;
  estimatedBatches?: number;
  summary?: {
    total: number;
    successful: number;
    failed: number;
  };
  results?: ImportResult[];
}

type ModalState = 'upload' | 'processing' | 'results';

export function ImportPortfolioModal({ open, onClose }: ImportPortfolioModalProps) {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ModalState>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [results, setResults] = useState<ImportResponse | null>(null);

  const resetModal = () => {
    setState('upload');
    setResults(null);
    setIsDragging(false);
  };

  const handleClose = () => {
    if (state === 'results') {
      queryClient.invalidateQueries({ queryKey: ['portfolio-companies'] });
    }
    resetModal();
    onClose();
  };

  const uploadFile = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `imports/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('portfolio-imports')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = await supabase.storage
      .from('portfolio-imports')
      .createSignedUrl(filePath, 3600);

    return { filePath, signedUrl: urlData?.signedUrl };
  };

  const processImport = async (signedUrl: string, fileName: string) => {
    const { data, error } = await supabase.functions.invoke('import-portfolio-csv', {
      body: {
        fileUrl: signedUrl,
        workspaceId: workspace?.id,
        fileName: fileName,
      },
    });

    if (error) throw error;
    return data as ImportResponse;
  };

  const cleanupFile = async (filePath: string) => {
    await supabase.storage
      .from('portfolio-imports')
      .remove([filePath]);
  };

  const handleFileSelect = useCallback(async (file: File) => {
    if (!workspace?.id) {
      toast.error("Aucun workspace sélectionné");
      return;
    }

    const validExtensions = ['csv', 'xlsx', 'xls'];
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    
    if (!fileExt || !validExtensions.includes(fileExt)) {
      toast.error("Format de fichier non supporté", {
        description: "Veuillez utiliser un fichier CSV ou Excel (.xlsx, .xls)",
      });
      return;
    }

    setState('processing');
    let filePath: string | null = null;

    try {
      // Upload file
      const uploadResult = await uploadFile(file);
      filePath = uploadResult.filePath;

      if (!uploadResult.signedUrl) {
        throw new Error("Impossible de générer l'URL du fichier");
      }

      // Process import
      const importResults = await processImport(uploadResult.signedUrl, file.name);

      // Handle async 202 response
      if (importResults.async && importResults.jobId) {
        toast.success(`Import lancé pour ${importResults.totalRows ?? '?'} lignes. L'enrichissement est en cours...`);
        resetModal();
        onClose();
        return;
      }

      // Legacy synchronous response
      setResults(importResults);
      setState('results');

      if (importResults.summary && importResults.summary.successful > 0) {
        toast.success(`${importResults.summary.successful} entreprise(s) importée(s)`);
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error("Erreur lors de l'import", {
        description: error.message || "Veuillez réessayer.",
      });
      setState('upload');
    } finally {
      // Cleanup file
      if (filePath) {
        cleanupFile(filePath).catch(console.error);
      }
    }
  }, [workspace?.id]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background rounded-xl shadow-2xl p-8 w-full max-w-lg relative">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          disabled={state === 'processing'}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <h1 className="text-2xl font-semibold text-center text-foreground">
          Importer des entreprises
        </h1>
        <p className="text-muted-foreground text-center mt-2 mb-8 text-sm">
          {state === 'upload' && "Importez vos données depuis un fichier CSV ou Excel"}
          {state === 'processing' && "Analyse en cours..."}
          {state === 'results' && "Résultats de l'import"}
        </p>

        {/* Upload State */}
        {state === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleInputChange}
                className="hidden"
              />
              <Upload className={cn(
                "h-12 w-12 mx-auto mb-4 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground"
              )} />
              <p className="text-foreground font-medium">
                Glissez votre fichier CSV ou Excel ici
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                ou cliquez pour sélectionner un fichier
              </p>
            </div>

            <div className="flex items-start gap-2 text-sm text-muted-foreground px-1">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Pour faciliter l'extraction, le fichier doit au minimum contenir : <span className="font-medium">Nom de l'entreprise</span>, <span className="font-medium">Montant investi</span>, <span className="font-medium">Date d'investissement</span>, <span className="font-medium">Valorisation d'entrée</span>, <span className="font-medium">Nom de domaine de l'entreprise</span>
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              <span>Formats acceptés : CSV, Excel (.xlsx, .xls)</span>
            </div>
          </div>
        )}

        {/* Processing State */}
        {state === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <div className="text-center space-y-2">
              <p className="text-foreground font-medium">
                Analyse du fichier en cours...
              </p>
              <p className="text-muted-foreground text-sm">
                Mistral AI extrait les données...
              </p>
            </div>
            {/* Indeterminate progress bar */}
            <div className="w-full max-w-xs h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-pulse w-2/3" />
            </div>
          </div>
        )}

        {/* Results State */}
        {state === 'results' && results && results.summary && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Badge variant="secondary" className="bg-accent text-accent-foreground">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {results.summary.successful} importée{results.summary.successful > 1 ? 's' : ''}
              </Badge>
              {results.summary.failed > 0 && (
                <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
                  <XCircle className="h-3 w-3 mr-1" />
                  {results.summary.failed} erreur{results.summary.failed > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {/* Results list */}
            <div className="max-h-80 overflow-y-auto space-y-2 border rounded-lg p-3">
              {(results.results ?? []).map((result, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-start gap-3 p-2 rounded-md",
                    result.success ? "bg-accent/50" : "bg-destructive/5"
                  )}
                >
                  {result.success ? (
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {result.company_name}
                    </p>
                    {result.error && (
                      <p className="text-xs text-destructive mt-0.5">
                        {result.error}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Close button */}
            <Button onClick={handleClose} className="w-full">
              Fermer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
