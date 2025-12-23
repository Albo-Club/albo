import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, BarChart3, Loader2, Clock, CheckCircle2, AlertCircle, Eye, Download, Mail, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MemoModal } from '@/components/MemoModal';

interface DeckFile {
  id: string;
  filename: string;
}

interface Deal {
  id: string;
  startup_name: string | null;
  company_name: string | null;
  sector: string | null;
  status: string;
  source: string | null;
  memo_html: string | null;
  created_at: string;
  analyzed_at: string | null;
  error_message: string | null;
  deck_files: DeckFile[];
}

export default function Dashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMemo, setSelectedMemo] = useState<{ html: string; companyName: string } | null>(null);
  const [downloadingDeck, setDownloadingDeck] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadDeals();

      // Subscribe to real-time updates on deals table
      const channel = supabase
        .channel('deals-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deals',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            // Reload all deals to get the joined deck_files
            loadDeals();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const loadDeals = async () => {
    try {
      const { data, error } = await supabase
        .from('deals')
        .select(`
          id, 
          startup_name, 
          company_name, 
          sector, 
          status, 
          source,
          memo_html,
          created_at, 
          analyzed_at, 
          error_message,
          deck_files (id, filename)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDeals((data || []) as Deal[]);
    } catch (error: any) {
      console.error('Error loading deals:', error);
      toast.error('Échec du chargement des deals');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Terminé
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20">
            <Clock className="h-3 w-3 mr-1 animate-pulse" />
            Analyse en cours...
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Erreur
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSourceLabel = (source: string | null) => {
    if (source === 'email') {
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Mail className="h-3 w-3" />
          Reçu par email
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <FileText className="h-3 w-3" />
        Soumis via formulaire
      </span>
    );
  };

  const handleViewMemo = (deal: Deal, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deal.memo_html) {
      setSelectedMemo({
        html: deal.memo_html,
        companyName: deal.company_name || deal.startup_name || 'Sans nom',
      });
    }
  };

  const handleDownloadDeck = async (dealId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingDeck(dealId);

    try {
      const { data: deckFile, error } = await supabase
        .from('deck_files')
        .select('filename, base64_content, mime_type')
        .eq('deal_id', dealId)
        .single();

      if (error) throw error;

      if (deckFile) {
        const link = document.createElement('a');
        link.href = `data:${deckFile.mime_type};base64,${deckFile.base64_content}`;
        link.download = deckFile.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Téléchargement démarré');
      }
    } catch (error: any) {
      console.error('Error downloading deck:', error);
      toast.error('Erreur lors du téléchargement');
    } finally {
      setDownloadingDeck(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Mes Deals</h1>
          <p className="text-muted-foreground">
            {deals.length > 0 
              ? `${deals.length} deal${deals.length > 1 ? 's' : ''}`
              : 'Suivez et analysez vos opportunités d\'investissement'}
          </p>
        </div>
        <Button onClick={() => navigate('/submit')}>
          <Plus className="mr-2 h-4 w-4" />
          Soumettre un Deal
        </Button>
      </div>

      {deals.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun deal</h3>
            <p className="text-muted-foreground mb-4">
              Commencez par soumettre votre premier pitch deck pour analyse
            </p>
            <Button onClick={() => navigate('/submit')}>
              <Plus className="mr-2 h-4 w-4" />
              Soumettre un Deal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {deals.map((deal) => (
            <Card 
              key={deal.id} 
              className="cursor-pointer hover:shadow-elegant transition-all duration-300 group"
              onClick={() => navigate(`/deal/${deal.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg line-clamp-1">
                    {deal.company_name || deal.startup_name || 'Analyse en cours...'}
                  </CardTitle>
                  {getStatusBadge(deal.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Soumis le {format(new Date(deal.created_at), 'dd MMM yyyy', { locale: fr })}
                  </p>
                  {getSourceLabel(deal.source)}
                  {deal.status === 'error' && deal.error_message && (
                    <p className="text-xs text-red-500 line-clamp-2">
                      {deal.error_message}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={deal.status !== 'completed' || !deal.memo_html}
                    onClick={(e) => handleViewMemo(deal, e)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Voir le Mémo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={!deal.deck_files || deal.deck_files.length === 0 || downloadingDeck === deal.id}
                    onClick={(e) => handleDownloadDeck(deal.id, e)}
                  >
                    {downloadingDeck === deal.id ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-1" />
                    )}
                    Deck
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedMemo && (
        <MemoModal
          open={!!selectedMemo}
          onOpenChange={(open) => !open && setSelectedMemo(null)}
          memoHtml={selectedMemo.html}
          companyName={selectedMemo.companyName}
        />
      )}
    </div>
  );
}
