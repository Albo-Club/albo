import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, BarChart3, Loader2, Clock, CheckCircle2, AlertCircle, Eye, Download, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MemoModal } from '@/components/MemoModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { displayCompanyName } from '@/lib/utils';
import { EditableBadge } from '@/components/EditableBadge';

interface DeckFile {
  id: string;
  file_name: string;
}

interface Deal {
  id: string;
  user_id: string | null;
  company_name: string | null;
  sector: string | null;
  stage: string | null;
  amount_sought: string | null;
  funding_type: string | null;
  status: string;
  source: string | null;
  sender_email: string | null;
  memo_html: string | null;
  additional_context: string | null;
  created_at: string;
  updated_at: string | null;
  analyzed_at: string | null;
  error_message: string | null;
  deck_files: DeckFile[];
}

const STAGE_OPTIONS = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Growth'];
const SECTOR_OPTIONS = ['FinTech', 'HealthTech', 'EdTech', 'CleanTech', 'SaaS', 'Marketplace', 'B2B', 'B2C', 'DeepTech', 'AI/ML', 'Other'];
const FUNDING_TYPE_OPTIONS = ['BSA-AIR', 'Equity', 'Convertible', 'Obligations', 'SAFE', 'Autre'];

export default function Dashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemo, setSelectedMemo] = useState<{ html: string; companyName: string } | null>(null);
  const [downloadingDeck, setDownloadingDeck] = useState<string | null>(null);
  const [dealToDelete, setDealToDelete] = useState<Deal | null>(null);
  const [deletingDeal, setDeletingDeal] = useState(false);
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
    if (!user?.id || !user?.email) {
      setLoading(false);
      return;
    }
    
    try {
      console.log('Loading deals for user:', user.id, 'and email:', user.email);
      
      // Load deals where user_id matches OR sender_email matches user's email
      // Filter out hidden deals
      const { data: dealsData, error: dealsError } = await supabase
        .from('deals')
        .select('id, user_id, company_name, sector, stage, amount_sought, funding_type, status, source, sender_email, memo_html, additional_context, created_at, updated_at, analyzed_at, error_message')
        .or(`user_id.eq.${user.id},sender_email.eq.${user.email}`)
        .or('is_hidden.is.null,is_hidden.eq.false')
        .order('created_at', { ascending: false });

      if (dealsError) {
        console.error('Deals query error:', dealsError);
        throw dealsError;
      }

      console.log('Deals loaded:', dealsData?.length || 0);

      // Then load deck_files separately for each deal
      const dealsWithFiles = await Promise.all(
        (dealsData || []).map(async (deal) => {
          const { data: files } = await supabase
            .from('deck_files')
            .select('id, file_name')
            .eq('deal_id', deal.id);
          
          return {
            ...deal,
            deck_files: files || [],
          };
        })
      );

      setDeals(dealsWithFiles as Deal[]);
    } catch (error: any) {
      console.error('Error loading deals:', error);
      toast.error(`Échec du chargement des deals: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredDeals = deals.filter(deal =>
    (deal.company_name || '')
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

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


  const handleViewMemo = (deal: Deal, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deal.memo_html) {
      setSelectedMemo({
        html: deal.memo_html,
        companyName: displayCompanyName(deal.company_name) || 'Sans nom',
      });
    }
  };

  const handleDownloadDeck = async (deal: Deal, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingDeck(deal.id);

    try {
      // First try by deal_id
      let { data: deckFile } = await supabase
        .from('deck_files')
        .select('file_name, base64_content, mime_type')
        .eq('deal_id', deal.id)
        .maybeSingle();

      // If not found, try by sender_email
      if (!deckFile && deal.sender_email) {
        const { data } = await supabase
          .from('deck_files')
          .select('file_name, base64_content, mime_type')
          .eq('sender_email', deal.sender_email)
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        deckFile = data;
      }

      if (!deckFile) {
        toast.error('Aucun deck trouvé pour ce deal');
        return;
      }

      if (deckFile.base64_content) {
        const link = document.createElement('a');
        link.href = `data:${deckFile.mime_type || 'application/pdf'};base64,${deckFile.base64_content}`;
        link.download = deckFile.file_name || 'pitch-deck.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Deck téléchargé !');
      } else {
        toast.error('Contenu du deck non disponible');
      }
    } catch (error: any) {
      console.error('Error downloading deck:', error);
      toast.error('Erreur lors du téléchargement');
    } finally {
      setDownloadingDeck(null);
    }
  };

  const handleSaveBadge = async (dealId: string, field: string, value: string) => {
    try {
      const updateValue = value === '_none_' ? null : value;
      const { error } = await supabase
        .from('deals')
        .update({ [field]: updateValue })
        .eq('id', dealId);

      if (error) throw error;

      setDeals(prev =>
        prev.map(d =>
          d.id === dealId ? { ...d, [field]: updateValue } : d
        )
      );
      toast.success('Saved!');
    } catch (error: any) {
      console.error('Error saving badge:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleHideDeal = async () => {
    if (!dealToDelete) return;

    setDeletingDeal(true);

    try {
      const { error } = await supabase
        .from('deals')
        .update({ is_hidden: true })
        .eq('id', dealToDelete.id);

      if (error) throw error;

      setDeals((prev) => prev.filter((d) => d.id !== dealToDelete.id));
      toast.success('Deal archivé');
      setDealToDelete(null);
    } catch (error: any) {
      console.error('Error hiding deal:', error);
      toast.error(error.message || 'Erreur lors de l\'archivage');
    } finally {
      setDeletingDeal(false);
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
            {filteredDeals.length > 0 
              ? `${filteredDeals.length} deal${filteredDeals.length > 1 ? 's' : ''}`
              : 'Suivez et analysez vos opportunités d\'investissement'}
          </p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by company name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-9"
            />
          </div>
          <Button onClick={() => navigate('/submit')}>
            <Plus className="mr-2 h-4 w-4" />
            Soumettre un Deal
          </Button>
        </div>
      </div>

      {filteredDeals.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? 'No deals found matching your search' : 'Aucun deal'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? 'Essayez un autre terme de recherche'
                : 'Commencez par soumettre votre premier pitch deck pour analyse'}
            </p>
            {!searchQuery && (
              <Button onClick={() => navigate('/submit')}>
                <Plus className="mr-2 h-4 w-4" />
                Soumettre un Deal
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDeals.map((deal) => (
            <Card 
              key={deal.id} 
              className="cursor-pointer hover:shadow-elegant transition-all duration-300 group"
              onClick={() => navigate(`/deal/${deal.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg line-clamp-1">
                    {displayCompanyName(deal.company_name) || 'Analyse en cours...'}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(deal.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDealToDelete(deal);
                      }}
                      aria-label="Supprimer le deal"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Category badges */}
                <div className="flex flex-wrap gap-2">
                  <EditableBadge
                    value={deal.stage}
                    field="stage"
                    dealId={deal.id}
                    options={STAGE_OPTIONS}
                    placeholder="Stage"
                    variant="stage"
                    onSave={handleSaveBadge}
                  />
                  <EditableBadge
                    value={deal.sector}
                    field="sector"
                    dealId={deal.id}
                    options={SECTOR_OPTIONS}
                    placeholder="Secteur"
                    variant="sector"
                    onSave={handleSaveBadge}
                  />
                  <EditableBadge
                    value={deal.amount_sought}
                    field="amount_sought"
                    dealId={deal.id}
                    placeholder="Montant"
                    variant="amount"
                    onSave={handleSaveBadge}
                  />
                  <EditableBadge
                    value={deal.funding_type}
                    field="funding_type"
                    dealId={deal.id}
                    options={FUNDING_TYPE_OPTIONS}
                    placeholder="Type"
                    variant="funding"
                    onSave={handleSaveBadge}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Soumis le {format(new Date(deal.created_at), 'dd MMM yyyy', { locale: fr })}
                  </p>
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
                    disabled={downloadingDeck === deal.id}
                    onClick={(e) => handleDownloadDeck(deal, e)}
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

      <AlertDialog open={!!dealToDelete} onOpenChange={(open) => !open && setDealToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver ce deal ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le deal sera masqué de votre liste. Vous pourrez le retrouver ultérieurement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDeal}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingDeal}
              onClick={(e) => {
                e.preventDefault();
                handleHideDeal();
              }}
            >
              {deletingDeal ? 'Archivage…' : 'Archiver'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
