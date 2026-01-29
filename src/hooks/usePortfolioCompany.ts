import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PortfolioCompanyMetrics {
  aum?: number;
  mrr?: number;
  ebitda?: number;
  employees?: number;
  cash_position?: number;
  runway_months?: number;
  // Croissance YoY
  aum_growth_yoy?: number;
  mrr_growth_yoy?: number;
  employees_growth_yoy?: number;
}

export interface CompanyReport {
  id: string;
  report_title: string | null;
  report_period: string | null;
  report_type: string | null;
  headline: string | null;
  key_highlights: string[] | null;
  metrics: PortfolioCompanyMetrics | null;
  created_at: string;
  processed_at: string | null;
  processing_status: string | null;
  dust_conversation_url: string | null;
}

export interface PortfolioCompanyFull {
  id: string;
  workspace_id: string;
  company_name: string;
  sector: string | null;
  sectors: string[] | null;
  domain: string | null;
  preview: string | null;
  logo_url: string | null;
  amount_invested_euros: number | null;
  investment_date: string | null;
  investment_type: string | null;
  ownership_percentage: number | null;
  entry_valuation_euros: number | null;
  last_news: string | null;
  last_news_updated_at: string | null;
  latest_metrics: PortfolioCompanyMetrics | null;
  latest_report_id: string | null;
  displayed_metrics: string[] | null;
  related_people: string | null;
  related_people_linkedin: string | null;
  created_at: string;
  updated_at: string;
  // Report jointure
  latest_report?: CompanyReport | null;
}

export function usePortfolioCompany(companyId: string | undefined) {
  return useQuery({
    queryKey: ['portfolio-company', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      // Fetch company with latest report
      const { data: company, error } = await supabase
        .from('portfolio_companies')
        .select(`
          *,
          latest_report:company_reports!fk_portfolio_companies_latest_report(
            id,
            report_title,
            report_period,
            report_type,
            headline,
            key_highlights,
            metrics,
            created_at,
            processed_at,
            processing_status,
            dust_conversation_url
          )
        `)
        .eq('id', companyId)
        .maybeSingle();

      if (error) throw error;
      return company as PortfolioCompanyFull | null;
    },
    enabled: !!companyId,
  });
}
