import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Loader2, ExternalLink, Download } from 'lucide-react';

interface Deal {
  id: string;
  startup_name: string;
  company_name: string | null;
  website: string | null;
  sector: string;
  stage: string;
  country: string;
  status: string;
  memo_html: string | null;
  solution_summary: string | null;
  recommandation: string | null;
  created_at: string;
}

interface DeckFile {
  id: string;
  file_name: string;
  storage_path: string;
}

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [deckFile, setDeckFile] = useState<DeckFile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadDeal();
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

      const { data: deckData } = await supabase
        .from('deck_files')
        .select('id, file_name, storage_path')
        .eq('deal_id', id)
        .maybeSingle();

      setDeckFile(deckData);
    } catch (error: any) {
      console.error('Error loading deal:', error);
      toast.error('Erreur lors du chargement du deal');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDeck = async () => {
    if (!deckFile) return;

    try {
      const { data, error } = await supabase.storage
        .from('deck-files')
        .createSignedUrl(deckFile.storage_path, 60 * 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener');
      }
    } catch (error: any) {
      console.error('Error downloading deck:', error);
      toast.error('Échec du téléchargement');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-success text-success-foreground">Analysé</Badge>;
      case 'pending':
        return <Badge variant="secondary">En cours d'analyse</Badge>;
      case 'error':
        return <Badge variant="destructive">Erreur</Badge>;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{deal.startup_name}</h1>
            {getStatusBadge(deal.status)}
          </div>
          {deal.company_name && (
            <p className="text-muted-foreground">{deal.company_name}</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Deal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Secteur</p>
              <p className="font-medium">{deal.sector}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Stade</p>
              <p className="font-medium">{deal.stage}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pays</p>
              <p className="font-medium">{deal.country}</p>
            </div>
            {deal.website && (
              <div>
                <p className="text-sm text-muted-foreground">Site Web</p>
                <a
                  href={deal.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline flex items-center gap-1"
                >
                  Visiter <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deck File */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pitch Deck</CardTitle>
          </CardHeader>
          <CardContent>
            {deckFile ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{deckFile.file_name}</p>
                  </div>
                </div>
                <Button onClick={handleDownloadDeck} className="w-full" variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground">Aucun fichier</p>
            )}
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Statut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {getStatusBadge(deal.status)}
              <p className="text-sm text-muted-foreground">
                Créé le {new Date(deal.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Results */}
      {deal.status === 'completed' && (
        <div className="space-y-6">
          {deal.solution_summary && (
            <Card>
              <CardHeader>
                <CardTitle>Résumé</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{deal.solution_summary}</p>
              </CardContent>
            </Card>
          )}

          {deal.recommandation && (
            <Card>
              <CardHeader>
                <CardTitle>Recommandation</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{deal.recommandation}</p>
              </CardContent>
            </Card>
          )}

          {deal.memo_html && (
            <Card>
              <CardHeader>
                <CardTitle>Mémo d'Investissement</CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: deal.memo_html }}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {deal.status === 'pending' && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Analyse en cours</h3>
            <p className="text-muted-foreground">
              L'analyse de votre pitch deck est en cours. Cela peut prendre quelques minutes.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
