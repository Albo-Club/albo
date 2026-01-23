import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PortfolioCompanyMetric {
  id: string;
  company_id: string;
  metric_key: string;
  metric_value: string;
  metric_type: string;
  source_report_id: string | null;
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
        .select("*")
        .eq("company_id", companyId)
        .order("metric_key");

      if (error) {
        console.error("Error fetching portfolio company metrics:", error);
        throw error;
      }

      // Sort by priority, then alphabetically
      return (data as PortfolioCompanyMetric[]).sort((a, b) => {
        const priorityA = METRIC_PRIORITY[a.metric_key] || 100;
        const priorityB = METRIC_PRIORITY[b.metric_key] || 100;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return a.metric_key.localeCompare(b.metric_key);
      });
    },
    enabled: !!companyId,
  });

  // Create a map for quick access by key
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
