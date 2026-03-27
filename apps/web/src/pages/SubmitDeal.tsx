import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';



type StorageUploadResult = { storagePath: string; storageData: unknown };

const uploadToStorage = async (file: File, userId: string, dealId: string): Promise<StorageUploadResult> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${dealId}_${Date.now()}.${fileExt}`;
  const storagePath = `${userId}/${fileName}`;
  const { data: storageData, error: storageError } = await supabase.storage.from('deck-files').upload(storagePath, file, { cacheControl: '3600', upsert: false });
  if (storageError) throw storageError;
  return { storagePath, storageData };
};

export default function SubmitDeal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [additionalContext, setAdditionalContext] = useState('');
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);

  const handleCancelAnalysis = async () => {
    if (!analysisId) return;
    try {
      await supabase.from('analysis_requests').update({ status: 'cancelled' }).eq('id', analysisId);
      if (activeDealId) {
        await supabase.from('deals').update({ status: 'à traiter', error_message: t('notifications.analysisCancelled') }).eq('id', activeDealId);
      }
      toast.info(t('notifications.analysisCancelled'));
      setAnalysisId(null);
      setActiveDealId(null);
    } catch (error) {
      console.error('Error cancelling analysis:', error);
    }
  };

  useEffect(() => {
    if (!activeDealId) return;
    const channel = supabase.channel(`submit-deal-${activeDealId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deals', filter: `id=eq.${activeDealId}` }, (payload: any) => {
      const newStatus = payload.new?.status;
      if (newStatus && newStatus !== "en cours d'analyse") {
        toast.dismiss(`analysis-${analysisId}`);
        if (newStatus === 'A traiter' || newStatus === 'analysé') {
          toast.success(`${t('notifications.analysisComplete')}: ${payload.new.company_name || 'Deal'}`);
        }
        setAnalysisId(null);
        setActiveDealId(null);
      }
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeDealId, analysisId, t]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') { toast.error(t('submitDeal.pdfOnlyError')); return; }
      if (selectedFile.size > 50 * 1024 * 1024) { toast.error(t('submitDeal.fileTooLarge')); return; }
      setFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.type !== 'application/pdf') { toast.error(t('submitDeal.pdfOnlyError')); return; }
      if (droppedFile.size > 50 * 1024 * 1024) { toast.error(t('submitDeal.fileTooLarge')); return; }
      setFile(droppedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast.error(t('submitDeal.selectFile')); return; }
    if (!user) { toast.error(t('submitDeal.mustBeLoggedIn')); return; }

    setIsSubmitting(true);
    try {
      // Check if there's already an analysis running or completed for a recent deal with the same file name
      const initialCompanyName = file.name.replace('.pdf', '').replace(/[-_]/g, ' ');
      
      // First create the deal
      const { data: deal, error: dealError } = await supabase.from('deals').insert({ user_id: user.id, company_name: initialCompanyName, status: "en cours d'analyse", source: 'form', additional_context: additionalContext || null }).select().single();
      if (dealError) throw dealError;
      setActiveDealId(deal.id);

      // Check existing analysis_requests for this deal
      const { data: existingAnalysis } = await supabase.from('analysis_requests').select('id, status').eq('deal_id', deal.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (existingAnalysis?.status === 'running') {
        toast.info('Une analyse est déjà en cours pour ce deal');
        navigate(`/deal/${deal.id}`);
        setIsSubmitting(false);
        return;
      }
      if (existingAnalysis?.status === 'completed') {
        toast.info('Ce deal a déjà été analysé');
        navigate(`/deal/${deal.id}`);
        setIsSubmitting(false);
        return;
      }

      const { data: analysisRecord, error: analysisError } = await supabase.from('analysis_requests').insert({ status: 'running', company_name: file.name.replace('.pdf', ''), user_id: user.id, deal_id: deal.id }).select('id').single();
      if (analysisError || !analysisRecord?.id) { toast.error('Failed to start analysis'); setIsSubmitting(false); return; }
      setAnalysisId(analysisRecord.id);
      if (dealError) throw dealError;
      setActiveDealId(deal.id);

      let storagePath = '';
      try {
        const uploadResult = await uploadToStorage(file, user.id, deal.id);
        storagePath = uploadResult.storagePath;
        const { error: deckFileError } = await supabase.from('deck_files').insert({ deal_id: deal.id, sender_email: user.email ?? null, file_name: file.name, storage_path: storagePath, mime_type: 'application/pdf' }).select('id, storage_path, file_name').single();
        if (deckFileError) throw deckFileError;
      } catch (deckError) {
        console.error('Deck upload/insert failed:', deckError);
        toast.error(t('common.error'));
        throw deckError;
      }

      // Trigger le pipeline d'analyse via edge function → Trigger.dev
      const { data: triggerData, error: triggerError } = await supabase.functions.invoke('deck-analysis', {
        body: {
          deal_id: deal.id,
          analysis_id: analysisRecord.id,
          user_email: user.email || '',
          additional_context: additionalContext || undefined,
          storage_paths: [
            {
              path: storagePath,
              file_name: file.name,
              mime_type: file.type || 'application/pdf',
            },
          ],
        },
      });
      if (triggerError) {
        console.error('Trigger error:', triggerError);
        await supabase.from('deals').update({ status: 'error', error_message: triggerError.message }).eq('id', deal.id);
        await supabase.from('analysis_requests').update({ status: 'error' }).eq('id', analysisRecord.id);
        toast.error(triggerError.message || "Erreur lors du lancement de l'analyse");
      } else {
        console.log('Analysis triggered, runId:', triggerData?.runId);
      }

      toast(t('submitDeal.analyzing'), {
        id: `analysis-${analysisRecord.id}`,
        duration: Infinity,
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        action: { label: '⬛ Stop', onClick: () => handleCancelAnalysis() },
      });

      navigate('/opportunities');
    } catch (error: any) {
      console.error('Error submitting deal:', error);
      toast.error(error.message || t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('submitDeal.title')}</h1>
        <p className="text-muted-foreground">{t('submitDeal.subtitle')}</p>
      </div>

      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle>{t('submitDeal.pitchDeck')}</CardTitle>
          <CardDescription>{t('submitDeal.pitchDeckDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="mt-2">
                {file ? (
                  <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setFile(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-lg font-medium mb-1">{t('submitDeal.dragDrop')}</p>
                      <p className="text-sm text-muted-foreground">{t('submitDeal.orClick')}</p>
                      <p className="text-xs text-muted-foreground mt-2">{t('submitDeal.pdfOnly')}</p>
                    </div>
                    <input type="file" className="hidden" accept=".pdf,application/pdf" onChange={handleFileChange} />
                  </label>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="additional-context">{t('submitDeal.additionalContext')}</Label>
              <Textarea id="additional-context" placeholder={t('submitDeal.additionalContextPlaceholder')} value={additionalContext} onChange={(e) => setAdditionalContext(e.target.value)} rows={4} className="resize-none" />
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate('/opportunities')} className="flex-1">
                {t('submitDeal.cancel')}
              </Button>
              <Button type="submit" disabled={!file || isSubmitting} className="flex-1">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {isSubmitting ? t('submitDeal.submitting') : t('submitDeal.analyze')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
