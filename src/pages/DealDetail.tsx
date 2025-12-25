import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, RefreshCw, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import AnalysisLoader from '@/components/AnalysisLoader';
import { InvestmentMemoDisplay } from '@/components/InvestmentMemoDisplay';
import { MemoHtmlFrame } from '@/components/MemoHtmlFrame';
import { displayCompanyName } from '@/lib/utils';

const N8N_WEBHOOK_URL = 'https://n8n.alboteam.com/webhook/619a0db8-a332-4d7d-bcbb-79e2fcd06141';

interface Deal {
  id: string;
  user_id: string | null;
  company_name: string | null;
  sector: string | null;
  stage: string | null;
  status: string;
  source: string | null;
  sender_email: string | null;
  memo_html: string | null;
  additional_context: string | null;
  amount_sought: string | null;
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
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (id) {
      loadDeal();

      // Subscribe to real-time updates
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
            setDeal(prev => prev ? { ...prev, ...payload.new } as Deal : null);
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
        .single();

      if (dealError) throw dealError;
      setDeal(dealData);
    } catch (error: any) {
      console.error('Error loading deal:', error);
      toast.error('Erreur lors du chargement du deal');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryAnalysis = async () => {
    if (!deal) return;
    
    setRetrying(true);
    
    try {
      // Update status to pending
      await supabase
        .from('deals')
        .update({ status: 'pending', error_message: null })
        .eq('id', deal.id);

      toast.info('Relance de l\'analyse...');

      // Note: In a real scenario, you'd need to re-upload the file or store it
      // For now, we'll just call the webhook with the deal_id
      const formData = new FormData();
      formData.append('deal_id', deal.id);

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`N8N Error: ${response.status}`);
      }

      const result = await response.json();

      await supabase
        .from('deals')
        .update({
          company_name: result.company_name || deal.company_name,
          memo_html: result.memo_html,
          status: 'completed',
          analyzed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', deal.id);

      toast.success('Analyse terminée !');
    } catch (error: any) {
      console.error('Retry error:', error);
      
      await supabase
        .from('deals')
        .update({
          status: 'error',
          error_message: error.message || 'Erreur lors de l\'analyse',
        })
        .eq('id', deal.id);

      toast.error('Erreur lors de l\'analyse');
    } finally {
      setRetrying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Terminé
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <Clock className="h-3 w-3 mr-1 animate-pulse" />
            Analyse en cours...
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Erreur
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
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
    const displayName = displayCompanyName(deal.company_name) || 'Analyse en cours...';

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{displayName}</h1>
              {getStatusBadge(deal.status)}
            </div>
          </div>
        </div>

        <AnalysisLoader />
      </div>
    );
  }

  // Show error state
  if (deal.status === 'error') {
    const displayName = displayCompanyName(deal.company_name) || 'Sans nom';

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{displayName}</h1>
              {getStatusBadge(deal.status)}
            </div>
          </div>
        </div>

        <Card className="border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Erreur d'analyse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {deal.error_message || 'Une erreur s\'est produite lors de l\'analyse du pitch deck.'}
            </p>
            <Button onClick={handleRetryAnalysis} disabled={retrying}>
              {retrying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Relance en cours...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Relancer l'analyse
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show completed analysis with memo
  const displayName = displayCompanyName(deal.company_name) || '';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{displayName}</h1>
            {getStatusBadge(deal.status)}
          </div>
          {deal.analyzed_at && (
            <p className="text-sm text-muted-foreground">
              Analysé le {new Date(deal.analyzed_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
        </div>
      </div>

      {deal.memo_html ? (
        <Card className="overflow-hidden">
          <CardContent className="p-0 h-[75vh]">
            <MemoHtmlFrame html={deal.memo_html} title={`Mémo - ${displayName}`} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Aucun mémo disponible pour ce deal.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
