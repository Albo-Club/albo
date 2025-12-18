import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, BarChart3, Loader2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Deal {
  id: string;
  startup_name: string | null;
  company_name: string | null;
  sector: string | null;
  status: string;
  created_at: string;
  analyzed_at: string | null;
  error_message: string | null;
}

export default function Dashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
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
          (payload) => {
            console.log('Deal updated:', payload);
            if (payload.eventType === 'INSERT') {
              setDeals(prev => [payload.new as Deal, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setDeals(prev =>
                prev.map(deal =>
                  deal.id === payload.new.id ? { ...deal, ...payload.new } as Deal : deal
                )
              );
            } else if (payload.eventType === 'DELETE') {
              setDeals(prev => prev.filter(deal => deal.id !== payload.old.id));
            }
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
        .select('id, startup_name, company_name, sector, status, created_at, analyzed_at, error_message')
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
              className="cursor-pointer hover:shadow-elegant transition-all duration-300 group"
              onClick={() => navigate(`/deal/${deal.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg line-clamp-1">
                    {deal.company_name || deal.startup_name || 'Sans nom'}
                  </CardTitle>
                  {getStatusBadge(deal.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {deal.sector && (
                    <Badge variant="outline" className="text-xs">
                      {deal.sector}
                    </Badge>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Créé {formatDistanceToNow(new Date(deal.created_at), { 
                      addSuffix: true, 
                      locale: fr 
                    })}
                  </p>
                  {deal.status === 'error' && deal.error_message && (
                    <p className="text-xs text-red-500 line-clamp-2">
                      {deal.error_message}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
