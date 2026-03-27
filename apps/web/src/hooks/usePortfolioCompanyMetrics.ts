import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PortfolioCompanyMetric {
  id: string;
  company_id: string;
  metric_key: string;
  canonical_key: string | null;
  metric_category: string | null;
  metric_value: string;
  metric_type: string;
  source_report_id: string | null;
  report_period: string | null;
  period_sort_date: string | null;
  updated_at: string;
  created_at: string;
}

// Priority order for metrics display
const METRIC_PRIORITY: Record<string, number> = {
  mrr: 1,
  arr: 2,
  revenue: 3,
  customers: 4,
  aum: 5,
  ebitda: 6,
  cash_position: 7,
  runway_months: 8,
  employees: 9,
};

export function usePortfolioCompanyMetrics(companyId: string | undefined) {
  const query = useQuery({
    queryKey: ["portfolio-company-metrics", companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from("portfolio_company_metrics")
        .select("id, company_id, metric_key, canonical_key, metric_category, metric_value, metric_type, source_report_id, report_period, period_sort_date, updated_at, created_at")
        .eq("company_id", companyId)
        .order("period_sort_date", { ascending: true, nullsFirst: false });

      if (error) {
        console.error("Error fetching portfolio company metrics:", error);
        throw error;
      }

      // Sort by priority, then alphabetically
      return (data as PortfolioCompanyMetric[]).sort((a, b) => {
        const keyA = a.canonical_key || a.metric_key;
        const keyB = b.canonical_key || b.metric_key;
        const priorityA = METRIC_PRIORITY[keyA] || 100;
        const priorityB = METRIC_PRIORITY[keyB] || 100;
        if (priorityA !== priorityB) return priorityA - priorityB;
        const ckComp = keyA.localeCompare(keyB);
        if (ckComp !== 0) return ckComp;
        // Within same canonical_key, sort by period_sort_date
        const dateA = a.period_sort_date || "";
        const dateB = b.period_sort_date || "";
        return dateA.localeCompare(dateB);
      });
    },
    enabled: !!companyId,
  });

  const metricsMap = new Map<string, PortfolioCompanyMetric>();
  if (query.data) {
    query.data.forEach((metric) => {
      metricsMap.set(metric.metric_key, metric);
    });
  }

  return {
    metrics: query.data || [],
    metricsMap,
    isLoading: query.isLoading,
    error: query.error,
  };
}
