import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, BarChart3, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Deal {
  id: string;
  startup_name: string;
  company_name: string | null;
  sector: string;
  status: string;
  memo_html: string | null;
  deck_files: { storage_path: string; file_name: string }[] | null;
}

export default function Dashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDeals();

    // Subscribe to real-time updates on deals table
    const channel = supabase
      .channel('deals-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deals'
        },
        (payload) => {
          console.log('Deal updated:', payload);
          setDeals(prev =>
            prev.map(deal =>
              deal.id === payload.new.id ? { ...deal, ...payload.new } as Deal : deal
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadDeals = async () => {
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('id, startup_name, company_name, sector, status, memo_html, deck_files(storage_path, file_name)')
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
        return <Badge className="bg-success text-success-foreground">Analysé</Badge>;
      case 'pending':
        return <Badge variant="secondary">En cours</Badge>;
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

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Mes Deals</h1>
          <p className="text-muted-foreground">Suivez et analysez vos opportunités d'investissement</p>
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
              className="cursor-pointer hover:shadow-elegant transition-all duration-300"
              onClick={() => navigate(`/deal/${deal.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{deal.startup_name}</CardTitle>
                  {getStatusBadge(deal.status)}
                </div>
                {deal.company_name && (
                  <p className="text-sm text-muted-foreground">{deal.company_name}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">{deal.sector}</Badge>
                </div>
                {deal.deck_files && deal.deck_files.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{deal.deck_files[0].file_name}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
