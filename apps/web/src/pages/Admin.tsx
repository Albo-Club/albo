import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Users, FileText, BarChart3 } from 'lucide-react';

interface Stats {
  totalDeals: number;
  pendingDeals: number;
  completedDeals: number;
  totalUsers: number;
}

export default function Admin() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalDeals: 0,
    pendingDeals: 0,
    completedDeals: 0,
    totalUsers: 0,
  });

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast.error('Accès non autorisé');
      navigate('/portfolio');
    } else if (isAdmin) {
      loadStats();
    }
  }, [isAdmin, authLoading, navigate]);

  const loadStats = async () => {
    try {
      // Load deals count
      const { count: totalDeals } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true });

      const { count: pendingDeals } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { count: completedDeals } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalDeals: totalDeals || 0,
        pendingDeals: pendingDeals || 0,
        completedDeals: completedDeals || 0,
        totalUsers: totalUsers || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Administration</h1>
        <p className="text-muted-foreground">Vue d'ensemble de la plateforme</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deals</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDeals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Attente</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingDeals}</div>
            <Badge variant="secondary" className="mt-1">Pending</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analysés</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedDeals}</div>
            <Badge className="bg-success text-success-foreground mt-1">Completed</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
