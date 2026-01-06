import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, BarChart3, Loader2, Clock, CheckCircle2, AlertCircle, Eye, Download, Trash2, Search, Filter, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MemoModal } from '@/components/MemoModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { displayCompanyName } from '@/lib/utils';
import { EditableBadge } from '@/components/EditableBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Deal {
  id: string;
  user_id: string | null;
  company_name: string | null;
  one_liner: string | null;
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
  hasDeck?: boolean;
}

const STAGE_OPTIONS = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Growth'];
const SECTOR_OPTIONS = ['FinTech', 'HealthTech', 'EdTech', 'CleanTech', 'SaaS', 'Marketplace', 'B2B', 'B2C', 'DeepTech', 'AI/ML', 'Other'];
const FUNDING_TYPE_OPTIONS = ['BSA-AIR', 'Equity', 'Convertible', 'Obligations', 'SAFE', 'Autre'];
const STATUS_OPTIONS = ['pending', 'analyzed', 'completed', 'reviewing', 'passed', 'error'];

export default function Dashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemo, setSelectedMemo] = useState<{ html: string; companyName: string } | null>(null);
  const [downloadingDeck, setDownloadingDeck] = useState<string | null>(null);
  const [dealToDelete, setDealToDelete] = useState<Deal | null>(null);
  const [deletingDeal, setDeletingDeal] = useState(false);
  
  // Filters
  const [filterSector, setFilterSector] = useState<string>('');
  const [filterStage, setFilterStage] = useState<string>('');
  const [filterFundingType, setFilterFundingType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadDeals();

      // Subscribe to real-time updates on deals table - listen to all changes
      // since we filter by user_id OR sender_email in loadDeals
      const channel = supabase
        .channel('deals-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deals',
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
      
      // Load deals where user_id matches OR sender_email matches user's email (case-insensitive)
      // Filter out hidden deals using proper syntax
      const { data: dealsData, error: dealsError } = await supabase
        .from('deals')
        .select('*')
        .or(`user_id.eq.${user.id},sender_email.ilike.${user.email}`)
        .neq('is_hidden', true)
        .order('created_at', { ascending: false });
      
      console.log('Deals loaded:', dealsData?.map(d => ({
        id: d.id,
        company: d.company_name,
        has_memo: !!d.memo_html,
        memo_length: d.memo_html?.length || 0
      })));

      if (dealsError) {
        console.error('Deals query error:', dealsError);
        throw dealsError;
      }

      console.log('Deals loaded:', dealsData?.length || 0);

      // Check deck existence for each deal - verify storage_path OR base64_content exists
      const dealsWithDeckStatus = await Promise.all(
        (dealsData || []).map(async (deal) => {
          // Check by deal_id first - must have storage_path or base64_content
          let { data: deckFile, error: deckFileError } = await supabase
            .from('deck_files')
            .select('id, storage_path, base64_content')
            .eq('deal_id', deal.id)
            .limit(1)
            .maybeSingle();

          if (deckFileError) {
            console.error('deck_files query error (by deal_id):', deckFileError);
          }

          // If not found and sender_email exists, check by sender_email
          if (!deckFile && deal.sender_email) {
            const { data, error } = await supabase
              .from('deck_files')
              .select('id, storage_path, base64_content')
              .eq('sender_email', deal.sender_email)
              .limit(1)
              .maybeSingle();

            if (error) {
              console.error('deck_files query error (by sender_email):', error);
            }

            deckFile = data;
          }

          // hasDeck is true only if we have actual file content (storage_path or base64)
          const hasDeck = !!(deckFile && (deckFile.storage_path || deckFile.base64_content));
          console.log('Deal:', deal.id, 'DeckFile:', deckFile, 'hasDeck:', hasDeck);

          return {
            ...deal,
            hasDeck,
          };
        })
      );

      setDeals(dealsWithDeckStatus as Deal[]);
    } catch (error: any) {
      console.error('Error loading deals:', error);
      toast.error(`Échec du chargement des deals: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredDeals = useMemo(() => {
    let result = deals.filter(deal =>
      (deal.company_name || '')
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    );
    
    if (filterSector) {
      result = result.filter(d => d.sector?.toLowerCase() === filterSector.toLowerCase());
    }
    if (filterStage) {
      result = result.filter(d => d.stage?.toLowerCase() === filterStage.toLowerCase());
    }
    if (filterFundingType) {
      result = result.filter(d => d.funding_type?.toLowerCase() === filterFundingType.toLowerCase());
    }
    if (filterStatus) {
      result = result.filter(d => d.status?.toLowerCase() === filterStatus.toLowerCase());
    }
    
    // Sort by created_at
    result = result.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    
    return result;
  }, [deals, searchQuery, filterSector, filterStage, filterFundingType, filterStatus, sortOrder]);

  const hasActiveFilters = filterSector || filterStage || filterFundingType || filterStatus;
  
  const clearFilters = () => {
    setFilterSector('');
    setFilterStage('');
    setFilterFundingType('');
    setFilterStatus('');
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
        .select('file_name, storage_path, base64_content, mime_type')
        .eq('deal_id', deal.id)
        .maybeSingle();

      // If not found, try by sender_email
      if (!deckFile && deal.sender_email) {
        const { data } = await supabase
          .from('deck_files')
          .select('file_name, storage_path, base64_content, mime_type')
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

      // Prefer storage_path (Supabase Storage) over base64
      if (deckFile.storage_path) {
        // Generate signed URL valid for 1 hour
        const { data: signedUrlData, error: signedUrlError } = await supabase
          .storage
          .from('deck-files')
          .createSignedUrl(deckFile.storage_path, 60 * 60);

        if (signedUrlError) throw signedUrlError;

        if (signedUrlData?.signedUrl) {
          window.open(signedUrlData.signedUrl, '_blank', 'noopener');
          toast.success('Deck ouvert dans un nouvel onglet');
        }
      } else if (deckFile.base64_content) {
        // Fallback to base64 for old files
        const byteCharacters = atob(deckFile.base64_content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: deckFile.mime_type || 'application/pdf' });
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = deckFile.file_name || 'pitch-deck.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
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
    <div className="space-y-4 w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mes Deals</h1>
          <p className="text-sm text-muted-foreground">
            {filteredDeals.length > 0 
              ? `${filteredDeals.length} deal${filteredDeals.length > 1 ? 's' : ''}`
              : 'Suivez et analysez vos opportunités d\'investissement'}
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 pl-9 h-9"
            />
          </div>
          <Button size="sm" onClick={() => navigate('/submit')}>
            <Plus className="mr-1 h-4 w-4" />
            Soumettre
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-card border border-border rounded-lg">
        <Filter className="h-4 w-4 text-muted-foreground" />
        
        <Select value={filterSector} onValueChange={setFilterSector}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="Secteur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous</SelectItem>
            {SECTOR_OPTIONS.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue placeholder="Stade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous</SelectItem>
            {STAGE_OPTIONS.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={filterFundingType} onValueChange={setFilterFundingType}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous</SelectItem>
            {FUNDING_TYPE_OPTIONS.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous</SelectItem>
            {STATUS_OPTIONS.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'desc' | 'asc')}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Plus récent</SelectItem>
            <SelectItem value="asc">Plus ancien</SelectItem>
          </SelectContent>
        </Select>
        
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs">
            <X className="h-3 w-3 mr-1" />
            Effacer
          </Button>
        )}
      </div>

      {filteredDeals.length === 0 ? (
        <Card className="text-center py-10">
          <CardContent>
            <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-base font-semibold mb-2">
              {searchQuery || hasActiveFilters ? 'Aucun deal trouvé' : 'Aucun deal'}
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              {searchQuery || hasActiveFilters
                ? 'Essayez d\'autres filtres'
                : 'Commencez par soumettre votre premier pitch deck'}
            </p>
            {!searchQuery && !hasActiveFilters && (
              <Button size="sm" onClick={() => navigate('/submit')}>
                <Plus className="mr-1 h-4 w-4" />
                Soumettre
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredDeals.map((deal) => (
            <Card 
              key={deal.id} 
              className="hover:shadow-elegant transition-all duration-300 group"
            >
              <CardContent className="p-3 space-y-2">
                {/* Header with title and actions */}
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm line-clamp-1">
                      {displayCompanyName(deal.company_name) || 'Analyse en cours...'}
                    </h3>
                    {/* One liner */}
                    {deal.one_liner && (
                      <p className="text-xs text-muted-foreground line-clamp-3 mt-1">
                        {deal.one_liner}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDealToDelete(deal);
                    }}
                    aria-label="Archiver le deal"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
                
                {/* Minimal badges - only stage and sector */}
                <div className="flex flex-wrap gap-1">
                  {deal.stage && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                      {deal.stage}
                    </Badge>
                  )}
                  {deal.sector && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                      {deal.sector}
                    </Badge>
                  )}
                </div>

                {/* Date and status */}
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(deal.created_at), 'dd MMM yy', { locale: fr })}
                  </p>
                  {getStatusBadge(deal.status)}
                </div>

                {deal.status === 'error' && deal.error_message && (
                  <p className="text-[10px] text-red-500 line-clamp-1">
                    {deal.error_message}
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex gap-1.5 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-xs px-2"
                    disabled={!deal.memo_html}
                    onClick={(e) => handleViewMemo(deal, e)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Mémo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-xs px-2"
                    disabled={downloadingDeck === deal.id || !deal.hasDeck}
                    onClick={(e) => handleDownloadDeck(deal, e)}
                  >
                    {downloadingDeck === deal.id ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3 mr-1" />
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
