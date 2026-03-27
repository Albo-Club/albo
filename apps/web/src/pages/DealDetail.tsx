import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AnalysisLoader from '@/components/AnalysisLoader';
import { DealHeader } from '@/components/deals/DealHeader';
import { DealTabs } from '@/components/deals/DealTabs';
import { MemoWidget } from '@/components/deals/MemoWidget';
import { DealInfoCard } from '@/components/deals/DealInfoCard';
import { DealDocumentsList } from '@/components/deals/DealDocumentsList';
import { DealEmailTab } from '@/components/deals/DealEmailTab';
import { PdfPreviewModal } from '@/components/portfolio/PdfPreviewModal';
import { displayCompanyName } from '@/lib/utils';

interface Deal {
  id: string;
  user_id: string | null;
  company_name: string | null;
  sector: string | null;
  sub_sector: string | null;
  stage: string | null;
  status: string;
  source: string | null;
  sender_email: string | null;
  memo_html: string | null;
  memo_content: string | null;
  one_liner: string | null;
  additional_context: string | null;
  investment_amount_eur: number | null;
  funding_type: string | null;
  domain: string | null;
  mail_content: string | null;
  created_at: string;
  updated_at: string | null;
  analyzed_at: string | null;
  error_message: string | null;
}

interface DeckFile {
  id: string;
  storage_path: string | null;
  base64_content: string | null;
  file_name: string | null;
  mime_type: string | null;
}

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [deckFile, setDeckFile] = useState<DeckFile | null>(null);
  
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (id) {
      loadDeal();
      loadDeck();

      const channel = supabase
        .channel(`deal-${id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'deals',
            filter: `id=eq.${id}`
          },
          (payload) => {
            const newDeal = payload.new as Deal;
            setDeal(prev => prev ? { ...prev, ...newDeal } : null);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id]);

  const loadDeal = async () => {
    try {
      const { data: dealData, error: dealError } = await supabase
        .from('deals')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (dealError) throw dealError;
      if (!dealData) {
        toast.error('Deal non trouvé');
        navigate('/opportunities');
        return;
      }
      
      setDeal(dealData);
    } catch (error: any) {
      console.error('Error loading deal:', error);
      toast.error('Erreur lors du chargement du deal');
      navigate('/opportunities');
    } finally {
      setLoading(false);
    }
  };

  const loadDeck = async () => {
    try {
      const { data } = await supabase
        .from('deck_files')
        .select('id, storage_path, base64_content, file_name, mime_type')
        .eq('deal_id', id)
        .maybeSingle();
      
      setDeckFile(data || null);
    } catch (error) {
      console.error('Error loading deck:', error);
    }
  };

  const handleDownloadDeck = async () => {
    if (!deckFile) {
      toast.error('Aucun deck trouvé');
      return;
    }

    try {
      if (deckFile.storage_path) {
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('deck-files')
          .createSignedUrl(deckFile.storage_path, 300);

        if (signedUrlError || !signedUrlData?.signedUrl) {
          throw new Error('Impossible de générer le lien de téléchargement');
        }
        window.open(signedUrlData.signedUrl, '_blank');
      } else if (deckFile.base64_content) {
        const binaryString = atob(deckFile.base64_content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: deckFile.mime_type || 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = deckFile.file_name || 'deck.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const handleViewDeck = () => {
    if (deckFile?.storage_path || deckFile?.base64_content) {
      setPdfPreviewOpen(true);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!deal) return;

    try {
      const { error } = await supabase
        .from('deals')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', deal.id);

      if (error) throw error;
      
      setDeal(prev => prev ? { ...prev, status: newStatus } : null);
      toast.success('Statut mis à jour');
    } catch (error: any) {
      console.error('Status update error:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleRetryAnalysis = async () => {
    if (!deal || !deckFile?.storage_path || !user) return;

    setIsRetrying(true);
    try {
      // Create new analysis_requests entry
      const { data: analysisRecord, error: analysisError } = await supabase
        .from('analysis_requests')
        .insert({ status: 'running', company_name: deal.company_name, user_id: user.id, deal_id: deal.id })
        .select('id')
        .single();

      if (analysisError || !analysisRecord?.id) {
        toast.error('Impossible de relancer l\'analyse');
        return;
      }

      // Update deal status
      await supabase
        .from('deals')
        .update({ status: "en cours d'analyse", error_message: null, updated_at: new Date().toISOString() })
        .eq('id', deal.id);

      setDeal(prev => prev ? { ...prev, status: "en cours d'analyse", error_message: null } : null);

      // Trigger edge function
      const { error: triggerError } = await supabase.functions.invoke('deck-analysis', {
        body: {
          deal_id: deal.id,
          analysis_id: analysisRecord.id,
          user_email: user.email || '',
          additional_context: deal.additional_context || undefined,
          storage_paths: [{
            path: deckFile.storage_path,
            file_name: deckFile.file_name || 'deck.pdf',
            mime_type: deckFile.mime_type || 'application/pdf',
          }],
        },
      });

      if (triggerError) {
        await supabase.from('deals').update({ status: 'error', error_message: triggerError.message }).eq('id', deal.id);
        await supabase.from('analysis_requests').update({ status: 'error' }).eq('id', analysisRecord.id);
        toast.error(triggerError.message || "Erreur lors du lancement de l'analyse");
      } else {
        toast.success('Analyse relancée avec succès');
      }
    } catch (error: any) {
      console.error('Retry analysis error:', error);
      toast.error('Erreur lors de la relance');
    } finally {
      setIsRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Deal non trouvé</p>
        <Button onClick={() => navigate('/opportunities')} className="mt-4">
          Retour au Dealflow
        </Button>
      </div>
    );
  }

  const hasDeck = !!(deckFile?.storage_path || deckFile?.base64_content);

  // Show analysis loader for analyzing deals
  if (deal.status === 'en cours d\'analyse') {
    return (
      <div className="space-y-6">
        <DealHeader
          dealId={deal.id}
          companyName={displayCompanyName(deal.company_name) || 'Analyse en cours...'}
          status={deal.status}
          createdAt={deal.created_at}
          domain={deal.domain}
        />
        <AnalysisLoader />
      </div>
    );
  }

  const companyName = displayCompanyName(deal.company_name) || 'Sans nom';

  // Overview tab content
  const overviewContent = (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Memo Widget - 3 columns */}
      <div className="lg:col-span-3">
        {deal.memo_html ? (
          <MemoWidget memoHtml={deal.memo_html} companyName={companyName} />
        ) : (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground h-[calc(100vh-280px)] min-h-[400px] flex items-center justify-center">
            <div>
              <p className="text-lg font-medium">Aucun mémo disponible</p>
              <p className="text-sm mt-1">Ce deal n'a pas encore été analysé.</p>
            </div>
          </div>
        )}
      </div>

      {/* Info Card - 2 columns */}
      <div className="lg:col-span-2">
        <DealInfoCard
          deal={deal}
          onDownloadDeck={handleDownloadDeck}
          onViewDeck={handleViewDeck}
          hasDeck={hasDeck}
        />

        {/* Re-analyze button for error status */}
        {deal.status === 'error' && hasDeck && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-destructive font-medium mb-1">Erreur d'analyse</p>
            {deal.error_message && (
              <p className="text-xs text-muted-foreground mb-3">{deal.error_message}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryAnalysis}
              disabled={isRetrying}
              className="w-full"
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              {isRetrying ? 'Relance en cours...' : 'Relancer l\'analyse'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        <DealHeader
          dealId={deal.id}
          companyName={companyName}
          status={deal.status}
          oneLiner={deal.one_liner || undefined}
          createdAt={deal.created_at}
          domain={deal.domain}
          onStatusChange={handleStatusChange}
        />

        <DealTabs 
          overviewContent={overviewContent} 
          emailsContent={deal.mail_content ? <DealEmailTab mailContent={deal.mail_content} /> : undefined}
          foldersContent={<DealDocumentsList dealId={deal.id} />}
        />
      </div>

      {/* PDF Preview Modal for deck */}
      <PdfPreviewModal
        open={pdfPreviewOpen}
        onOpenChange={setPdfPreviewOpen}
        storagePath={deckFile?.storage_path || null}
        fileName={deckFile?.file_name || null}
        reportPeriod={null}
        bucket="deck-files"
      />
    </>
  );
}
