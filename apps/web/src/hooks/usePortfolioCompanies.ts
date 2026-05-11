import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface PortfolioCompany {
  id: string;
  workspace_id: string;
  company_name: string;
  sectors: string[] | null;
  domain: string | null;
  preview: string | null;
  logo_url: string | null;
  amount_invested_euros: number | null;
  investment_date: string | null;
  investment_type: string | null;
  ownership_percentage: number | null;
  entry_valuation_euros: number | null;
  latest_metrics: Record<string, unknown> | null;
  latest_report_id: string | null;
  displayed_metrics: string[] | null;
  sender_emails: string[] | null;
  ai_analysis: { health_score?: { score?: number } } | null;
  ai_analysis_status: 'processing' | 'completed' | 'error' | null;
  latest_report: {
    id: string;
    report_date: string | null;
    report_period: string | null;
    processing_status: string | null;
    is_duplicate: boolean;
  } | null;
  created_at: string;
  updated_at: string;
}

export function usePortfolioCompanies() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: ['portfolio-companies', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];

      const { data, error } = await supabase
        .from('portfolio_companies')
        .select(`
          *,
          latest_report:company_reports!fk_portfolio_companies_latest_report(
            id,
            report_date,
            report_period,
            processing_status,
            is_duplicate
          )
        `)
        .eq('workspace_id', workspace.id)
        .order('company_name');

      if (error) throw error;
      return data as PortfolioCompany[];
    },
    enabled: !!workspace?.id,
  });
}
