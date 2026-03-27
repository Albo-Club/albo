import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KpiCard {
  key: string;
  latest_value: string;
  latest_period: string;
  metric_type: string;
  source_report_id: string | null;
  previous_value: string | null;
  previous_period: string | null;
  change_pct: number | null;
}

export interface DataPoint {
  period: string;
  value: string;
  sort_date: string;
  source_report_id: string | null;
}

export interface TargetPoint {
  period: string;
  value: string;
  sort_date: string;
}

export interface TimeSeries {
  key: string;
  category: string;
  data_points: DataPoint[];
  targets: TargetPoint[];
}

export interface AvailableMetric {
  key: string;
  category: string;
  period_count: number;
  latest_period: string;
}

export interface DashboardMetrics {
  kpi_cards: KpiCard[];
  time_series: TimeSeries[];
  available_metrics: AvailableMetric[];
}

export function useCompanyDashboardMetrics(companyId: string) {
  return useQuery({
    queryKey: ["company-dashboard-metrics", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_company_dashboard_metrics", {
        p_company_id: companyId,
      } as any);
      if (error) throw error;
      return data as unknown as DashboardMetrics;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}
