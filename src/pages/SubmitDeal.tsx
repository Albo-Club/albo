import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, FileText, X, Loader2, Square } from 'lucide-react';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [additionalContext, setAdditionalContext] = useState('');
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);

  const handleCancelAnalysis = async () => {
    if (!analysisId) return;
    try {
      await supabase
        .from('analysis_requests')
        .update({ status: 'cancelled' })
        .eq('id', analysisId);

      if (activeDealId) {
        await supabase
          .from('deals')
          .update({ status: 'à traiter', error_message: "Analyse annulée par l'utilisateur" })
          .eq('id', activeDealId);
      }

      toast.info("L'analyse a été annulée");
      setAnalysisId(null);
      setActiveDealId(null);
    } catch (error) {
      console.error('Error cancelling analysis:', error);
    }
  };

  // Realtime listener to auto-dismiss toast when analysis completes
  useEffect(() => {
    if (!activeDealId) return;

    const channel = supabase
      .channel(`submit-deal-${activeDealId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deals',
          filter: `id=eq.${activeDealId}`,
        },
        (payload: any) => {
          const newStatus = payload.new?.status;
          if (newStatus && newStatus !== "en cours d'analyse") {
            toast.dismiss(`analysis-${analysisId}`);
            if (newStatus === 'A traiter' || newStatus === 'analysé') {
              toast.success(`Analyse terminée : ${payload.new.company_name || 'Deal'}`);
            }
            setAnalysisId(null);
            setActiveDealId(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeDealId, analysisId]);

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

    setIsSubmitting(true);

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

      if (analysisError || !analysisRecord?.id) {
        console.error('Failed to create analysis request:', analysisError);
        toast.error('Failed to start analysis');
        setIsSubmitting(false);
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
          status: "en cours d'analyse",
          source: 'form',
          additional_context: additionalContext || null,
        })
        .select()
        .single();

      console.log('2. Deal created:', deal?.id, dealError);

      if (dealError) throw dealError;

      setActiveDealId(deal.id);

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

        void storageData;
      } catch (deckError) {
        console.error('Deck upload/insert failed:', deckError);
        toast.error('Échec de l\'upload du deck (vérifier les permissions)');
        throw deckError;
      }

      // Step 4: Send PDF to N8N webhook (fire & forget)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('deal_id', deal.id);
      formData.append('analysis_id', analysisRecord.id);
      formData.append('additional_context', additionalContext || '');
      formData.append('user_email', user.email || '');

      fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        body: formData,
      }).catch((err) => {
        console.error('N8N webhook error (background):', err);
        supabase
          .from('deals')
          .update({
            status: 'à traiter',
            error_message: err.message || "Erreur de connexion au serveur d'analyse",
          })
          .eq('id', deal.id);
        supabase
          .from('analysis_requests')
          .update({ status: 'error' })
          .eq('id', analysisRecord.id);
      });

      // Persistent toast with cancel button
      toast('Analyse en cours...', {
        id: `analysis-${analysisRecord.id}`,
        duration: Infinity,
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        action: {
          label: '⬛ Stop',
          onClick: () => handleCancelAnalysis(),
        },
      });

      navigate('/opportunities');
    } catch (error: any) {
      console.error('Error submitting deal:', error);
      toast.error(error.message || 'Erreur lors de la soumission');
    } finally {
      setIsSubmitting(false);
    }
  };

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
                onClick={() => navigate('/opportunities')}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={!file || isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {isSubmitting ? 'Envoi en cours...' : 'Analyser le Deck'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
