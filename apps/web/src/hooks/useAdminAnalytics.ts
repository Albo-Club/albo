import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdminUserSummary {
  user_id: string;
  name: string | null;
  email: string | null;
  is_super_admin: boolean;
  account_created_at: string;
  last_login_at: string | null;
  logins_7d: number;
  actions_7d: number;
  logins_30d: number;
  actions_30d: number;
  emails_synced_30d: number;
  deals_created_30d: number;
  reports_processed_30d: number;
  total_actions_all_time: number;
  workspace_count: number;
}

interface DailyLogin {
  date: string;
  count: number;
}

interface ActionByCategory {
  category: string;
  count: number;
}

interface AdminAnalytics {
  activeUsers7d: number;
  loginsToday: number;
  totalActions30d: number;
  signupsThisMonth: number;
  dailyLogins: DailyLogin[];
  actionsByCategory: ActionByCategory[];
  userSummaries: AdminUserSummary[];
  isLoading: boolean;
  error: Error | null;
}

export function useAdminAnalytics(): AdminAnalytics {
  const [userSummaries, setUserSummaries] = useState<AdminUserSummary[]>([]);
  const [dailyLogins, setDailyLogins] = useState<DailyLogin[]>([]);
  const [actionsByCategory, setActionsByCategory] = useState<ActionByCategory[]>([]);
  const [signupsThisMonth, setSignupsThisMonth] = useState(0);
  const [loginsToday, setLoginsToday] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const today = now.toISOString().split('T')[0];

        // All queries in parallel
        const [summariesRes, dailyStatsRes, actionsRes, signupsRes, loginsTodayRes] = await Promise.all([
          supabase.from('admin_user_activity_summary').select('*'),
          supabase
            .from('user_daily_stats')
            .select('stat_date, login_count')
            .gte('stat_date', thirtyDaysAgo.toISOString().split('T')[0])
            .order('stat_date', { ascending: true }),
          supabase
            .from('user_activity_log')
            .select('event_category')
            .gte('created_at', thirtyDaysAgo.toISOString()),
          supabase
            .from('user_activity_log')
            .select('id', { count: 'exact', head: true })
            .eq('event_type', 'signup')
            .gte('created_at', startOfMonth.toISOString()),
          supabase
            .from('user_daily_stats')
            .select('login_count')
            .eq('stat_date', today),
        ]);

        if (summariesRes.error) throw summariesRes.error;
        if (dailyStatsRes.error) throw dailyStatsRes.error;
        if (actionsRes.error) throw actionsRes.error;

        setUserSummaries((summariesRes.data as AdminUserSummary[]) || []);

        // Aggregate daily logins by date
        const loginsByDate = new Map<string, number>();
        for (const row of dailyStatsRes.data || []) {
          const d = row.stat_date;
          loginsByDate.set(d, (loginsByDate.get(d) || 0) + (row.login_count || 0));
        }
        setDailyLogins(
          Array.from(loginsByDate.entries()).map(([date, count]) => ({ date, count }))
        );

        // Aggregate actions by category
        const catMap = new Map<string, number>();
        for (const row of actionsRes.data || []) {
          const cat = row.event_category || 'other';
          catMap.set(cat, (catMap.get(cat) || 0) + 1);
        }
        setActionsByCategory(
          Array.from(catMap.entries()).map(([category, count]) => ({ category, count }))
        );

        setSignupsThisMonth(signupsRes.count || 0);

        // Sum logins today
        const todaySum = (loginsTodayRes.data || []).reduce(
          (acc: number, r: any) => acc + (r.login_count || 0),
          0
        );
        setLoginsToday(todaySum);
      } catch (err: any) {
        console.error('Admin analytics error:', err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
  }, []);

  const activeUsers7d = userSummaries.filter((u) => u.logins_7d > 0).length;
  const totalActions30d = userSummaries.reduce((sum, u) => sum + (u.actions_30d || 0), 0);

  return {
    activeUsers7d,
    loginsToday,
    totalActions30d,
    signupsThisMonth,
    dailyLogins,
    actionsByCategory,
    userSummaries,
    isLoading,
    error,
  };
}
