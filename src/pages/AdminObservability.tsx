import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAnalytics, type AdminUserSummary } from '@/hooks/useAdminAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, LogIn, Activity, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, ResponsiveContainer } from 'recharts';
import { useState } from 'react';

const CATEGORY_COLORS: Record<string, string> = {
  auth: 'hsl(220, 70%, 55%)',
  email: 'hsl(160, 60%, 45%)',
  deal: 'hsl(35, 90%, 55%)',
  portfolio: 'hsl(270, 60%, 55%)',
  report: 'hsl(340, 65%, 50%)',
  chat: 'hsl(190, 70%, 45%)',
};

export default function AdminObservability() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const {
    activeUsers7d,
    loginsToday,
    totalActions30d,
    signupsThisMonth,
    dailyLogins,
    actionsByCategory,
    userSummaries,
    isLoading,
    error,
  } = useAdminAnalytics();

  const [sortKey, setSortKey] = useState<keyof AdminUserSummary>('logins_7d');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/dashboard');
    }
  }, [isAdmin, authLoading, navigate]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const handleSort = (key: keyof AdminUserSummary) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = [...userSummaries].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const loginChartConfig: ChartConfig = {
    count: { label: 'Logins', color: 'hsl(160, 60%, 45%)' },
  };

  const categoryChartConfig: ChartConfig = Object.fromEntries(
    actionsByCategory.map((a) => [
      a.category,
      { label: a.category, color: CATEGORY_COLORS[a.category] || 'hsl(0,0%,60%)' },
    ])
  );

  const SortIndicator = ({ col }: { col: keyof AdminUserSummary }) =>
    sortKey === col ? <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span> : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Observabilité</h1>
        <p className="text-muted-foreground">Suivi de l'activité utilisateurs</p>
      </div>

      {error && (
        <p className="text-sm text-destructive">Erreur : {error.message}</p>
      )}

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users actifs (7j)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsers7d}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Logins aujourd'hui</CardTitle>
            <LogIn className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loginsToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actions (30j)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActions30d}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Signups ce mois</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{signupsThisMonth}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logins par jour (30j)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={loginChartConfig} className="h-[260px] w-full">
              <LineChart data={dailyLogins}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  className="text-xs"
                />
                <YAxis allowDecimals={false} className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions par catégorie (30j)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={categoryChartConfig} className="h-[260px] w-full">
              <BarChart data={actionsByCategory}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="category" className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  radius={[4, 4, 0, 0]}
                  fill="hsl(var(--primary))"
                  // per-bar color via cell
                >
                  {actionsByCategory.map((entry) => (
                    <rect key={entry.category} fill={CATEGORY_COLORS[entry.category] || 'hsl(var(--primary))'} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* User table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Utilisateurs</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('last_login_at')}>
                  Dernier login<SortIndicator col="last_login_at" />
                </TableHead>
                <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort('logins_7d')}>
                  Logins 7j<SortIndicator col="logins_7d" />
                </TableHead>
                <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort('actions_30d')}>
                  Actions 30j<SortIndicator col="actions_30d" />
                </TableHead>
                <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort('emails_synced_30d')}>
                  Emails 30j<SortIndicator col="emails_synced_30d" />
                </TableHead>
                <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort('deals_created_30d')}>
                  Deals 30j<SortIndicator col="deals_created_30d" />
                </TableHead>
                <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort('workspace_count')}>
                  Workspaces<SortIndicator col="workspace_count" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">
                          {(u.name || u.email || '?').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{u.name || '—'}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      {u.is_super_admin && <Badge variant="secondary" className="text-[10px] px-1.5">Admin</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.last_login_at
                      ? formatDistanceToNow(new Date(u.last_login_at), { addSuffix: true, locale: fr })
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{u.logins_7d}</TableCell>
                  <TableCell className="text-right tabular-nums">{u.actions_30d}</TableCell>
                  <TableCell className="text-right tabular-nums">{u.emails_synced_30d}</TableCell>
                  <TableCell className="text-right tabular-nums">{u.deals_created_30d}</TableCell>
                  <TableCell className="text-right tabular-nums">{u.workspace_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
