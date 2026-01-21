import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, FileText, X } from 'lucide-react';
import AnalysisLoader from '@/components/AnalysisLoader';

const N8N_WEBHOOK_URL = 'https://n8n.alboteam.com/webhook/2551cfc4-1892-4926-9f17-746c9a51be71';

type StorageUploadResult = {
  storagePath: string;
  storageData: unknown;
};

// Upload file to Supabase Storage and return storage path
const uploadToStorage = async (file: File, userId: string, dealId: string): Promise<StorageUploadResult> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${dealId}_${Date.now()}.${fileExt}`;
  const storagePath = `${userId}/${fileName}`;

  const { data: storageData, error: storageError } = await supabase.storage
    .from('deck-files')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  console.log('3. Storage upload:', storageData, storageError);

  if (storageError) throw storageError;
  return { storagePath, storageData };
};

export default function SubmitDeal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [additionalContext, setAdditionalContext] = useState('');
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast.error('Seuls les fichiers PDF sont acceptés');
        return;
      }
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast.error('Le fichier ne doit pas dépasser 50 MB');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.type !== 'application/pdf') {
        toast.error('Seuls les fichiers PDF sont acceptés');
        return;
      }
      if (droppedFile.size > 50 * 1024 * 1024) {
        toast.error('Le fichier ne doit pas dépasser 50 MB');
        return;
      }
      setFile(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
  };

  const handleCancelAnalysis = async () => {
    if (!analysisId) return;

    try {
      await supabase
        .from('analysis_requests')
        .update({ status: 'cancelled' })
        .eq('id', analysisId);

      toast.info("L'analyse a été annulée");
      setIsAnalyzing(false);
      setAnalysisId(null);
    } catch (error) {
      console.error('Error cancelling analysis:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast.error('Veuillez sélectionner un fichier PDF');
      return;
    }

    if (!user) {
      toast.error('Vous devez être connecté');
      return;
    }

    setIsAnalyzing(true);

    try {
      console.log('1. User:', user?.id, user?.email);

      // Step 1: Create analysis_request with status='running'
      const { data: analysisRecord, error: analysisError } = await supabase
        .from('analysis_requests')
        .insert({
          status: 'running',
          company_name: file.name.replace('.pdf', ''),
          user_id: user.id,
        })
        .select('id')
        .single();

      // Vérifier que ça a marché
      if (analysisError || !analysisRecord?.id) {
        console.error('Failed to create analysis request:', analysisError);
        toast.error('Failed to start analysis');
        setIsAnalyzing(false);
        return;
      }

      setAnalysisId(analysisRecord.id);

      // Step 2: Create deal in "pending" status with initial company name from filename
      const initialCompanyName = file.name.replace('.pdf', '').replace(/[-_]/g, ' ');

      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .insert({
          user_id: user.id,
          company_name: initialCompanyName,
          status: 'analyzing',
          source: 'form',
          additional_context: additionalContext || null,
        })
        .select()
        .single();

      console.log('2. Deal created:', deal?.id, dealError);

      if (dealError) throw dealError;

      // Step 3: Upload PDF to Storage and store reference in deck_files
      try {
        const { storagePath, storageData } = await uploadToStorage(file, user.id, deal.id);

        const { data: deckFileData, error: deckFileError } = await supabase
          .from('deck_files')
          .insert({
            deal_id: deal.id,
            sender_email: user.email ?? null,
            file_name: file.name,
            storage_path: storagePath,
            mime_type: 'application/pdf',
          })
          .select('id, storage_path, file_name')
          .single();

        console.log('4. deck_files insert:', deckFileData, deckFileError);

        if (deckFileError) throw deckFileError;

        // keep for debugging parity with requested logs
        void storageData;
      } catch (deckError) {
        console.error('Deck upload/insert failed:', deckError);
        toast.error('Échec de l’upload du deck (vérifier les permissions)');
        throw deckError;
      }

      // Step 4: Send PDF to N8N webhook with analysis_id
      const formData = new FormData();
      formData.append('file', file);
      formData.append('deal_id', deal.id);
      formData.append('analysis_id', analysisRecord.id);
      formData.append('additional_context', additionalContext || '');

      try {
        const response = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`N8N Error: ${response.status}`);
        }

        const n8nRaw = await response.json();
        const result = Array.isArray(n8nRaw) ? n8nRaw?.[0] : n8nRaw;
        console.log('N8N Response (raw):', n8nRaw);
        console.log('N8N Response (normalized):', result);

        // Check if analysis was cancelled
        if (result?.cancelled === true) {
          toast.info("L'analyse a été annulée");
          setIsAnalyzing(false);
          return;
        }

        // Step 5: Update deal with N8N response
        if (result?.status === 'completed') {
          const updateData: any = {
            status: 'completed',
            analyzed_at: new Date().toISOString(),
          };

          // Update company_name if provided by N8N
          if (result.company_name) {
            updateData.company_name = result.company_name;
          }

          // Update memo_html if provided
          if (result.memo_html) {
            updateData.memo_html = result.memo_html;
          }

          const { error: updateDealError } = await supabase
            .from('deals')
            .update(updateData)
            .eq('id', deal.id);

          if (updateDealError) throw updateDealError;

          // Update analysis_request status
          const { error: updateAnalysisError } = await supabase
            .from('analysis_requests')
            .update({ status: 'completed' })
            .eq('id', analysisRecord.id);

          if (updateAnalysisError) throw updateAnalysisError;

          toast.success('Analyse terminée !');
        } else {
          const { error: updateDealError } = await supabase
            .from('deals')
            .update({
              status: 'pending',
              error_message: result?.error || "Échec de l'analyse",
            })
            .eq('id', deal.id);

          const { error: updateAnalysisError } = await supabase
            .from('analysis_requests')
            .update({ status: 'error' })
            .eq('id', analysisRecord.id);

          if (updateAnalysisError) throw updateAnalysisError;

          toast.error(result?.error || "Échec de l'analyse");
        }

        navigate('/dashboard');
      } catch (n8nError: any) {
        console.error('N8N Error:', n8nError);
        
        await supabase
          .from('deals')
          .update({
            status: 'pending',
            error_message: n8nError.message || 'Erreur lors de l\'analyse',
          })
          .eq('id', deal.id);

        await supabase
          .from('analysis_requests')
          .update({ status: 'error' })
          .eq('id', analysisRecord.id);

        toast.error('Erreur lors de l\'analyse. Vous pouvez réessayer depuis la page du deal.');
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Error submitting deal:', error);
      toast.error(error.message || 'Erreur lors de la soumission');
    } finally {
      setIsAnalyzing(false);
      setAnalysisId(null);
    }
  };

  // Show AnalysisLoader when analyzing
  if (isAnalyzing) {
    return (
      <div className="max-w-2xl mx-auto">
        <AnalysisLoader />
        <div className="flex justify-center mt-6">
          <Button
            variant="outline"
            onClick={handleCancelAnalysis}
            className="text-destructive hover:text-destructive"
          >
            Annuler l'analyse
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Soumettre un Deal</h1>
        <p className="text-muted-foreground">Uploadez votre pitch deck pour analyse automatique</p>
      </div>

      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle>Pitch Deck</CardTitle>
          <CardDescription>
            Uploadez simplement votre pitch deck en PDF. L'analyse extraira automatiquement toutes les informations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Upload */}
            <div>
              <div className="mt-2">
                {file ? (
                  <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label 
                    className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-lg font-medium mb-1">
                        Glissez-déposez votre pitch deck
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ou cliquez pour sélectionner un fichier
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">PDF uniquement (max. 50MB)</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,application/pdf"
                      onChange={handleFileChange}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Additional Context */}
            <div className="space-y-2">
              <Label htmlFor="additional-context">Contexte additionnel (optionnel)</Label>
              <Textarea
                id="additional-context"
                placeholder="Fournissez tout contexte utile pour l'analyse (ex: contenu d'email, notes, questions spécifiques...)"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={!file}
                className="flex-1"
              >
                <Upload className="mr-2 h-4 w-4" />
                Analyser le Deck
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
