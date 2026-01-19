import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AnalysisLoader from '@/components/AnalysisLoader';
import { DealHeader } from '@/components/deals/DealHeader';
import { DealTabs } from '@/components/deals/DealTabs';
import { MemoWidget } from '@/components/deals/MemoWidget';
import { DealInfoCard } from '@/components/deals/DealInfoCard';
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
  amount_sought: string | null;
  investment_amount_eur: number | null;
  funding_type: string | null;
  created_at: string;
  updated_at: string | null;
  analyzed_at: string | null;
  error_message: string | null;
}

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasDeck, setHasDeck] = useState(false);

  useEffect(() => {
    if (id) {
      loadDeal();
      checkDeck();

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
            console.log('Deal updated:', payload);
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
        navigate('/dashboard');
        return;
      }
      
      setDeal(dealData);
    } catch (error: any) {
      console.error('Error loading deal:', error);
      toast.error('Erreur lors du chargement du deal');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const checkDeck = async () => {
    try {
      const { data } = await supabase
        .from('deck_files')
        .select('id, storage_path, base64_content')
        .eq('deal_id', id)
        .maybeSingle();
      
      setHasDeck(!!(data?.storage_path || data?.base64_content));
    } catch (error) {
      console.error('Error checking deck:', error);
    }
  };

  const handleDownloadDeck = async () => {
    try {
      const { data: deckFile, error } = await supabase
        .from('deck_files')
        .select('*')
        .eq('deal_id', id)
        .maybeSingle();

      if (error || !deckFile) {
        toast.error('Aucun deck trouvé');
        return;
      }

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
        <Button onClick={() => navigate('/dashboard')} className="mt-4">
          Retour au Dashboard
        </Button>
      </div>
    );
  }

  // Show analysis loader for pending deals
  if (deal.status === 'pending') {
    return (
      <div className="space-y-6">
        <DealHeader
          dealId={deal.id}
          companyName={displayCompanyName(deal.company_name) || 'Analyse en cours...'}
          status={deal.status}
          createdAt={deal.created_at}
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
          hasDeck={hasDeck}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <DealHeader
        dealId={deal.id}
        companyName={companyName}
        status={deal.status}
        oneLiner={deal.one_liner || undefined}
        createdAt={deal.created_at}
        onStatusChange={handleStatusChange}
      />

      {/* Tabs */}
      <DealTabs overviewContent={overviewContent} />
    </div>
  );
}
