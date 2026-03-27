import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PortfolioCompany } from './usePortfolioCompanies';

export interface CompanyReportData {
  id: string;
  report_date: string | null;
  report_title: string | null;
  report_period: string | null;
  report_type: string | null;
  headline: string | null;
  cleaned_content: string | null;
  key_highlights: string[] | null;
  metrics: Record<string, unknown> | null;
  processed_at: string | null;
}

export interface PortfolioCompanyWithReport extends PortfolioCompany {
  latest_report?: CompanyReportData | null;
  related_people?: string | null;
  related_people_linkedin?: string | null;
}

export function usePortfolioCompanyWithReport(companyId: string | undefined) {
  return useQuery({
    queryKey: ['portfolio-company-with-report', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const { data, error } = await supabase
        .from('portfolio_companies')
        .select(`
          *,
          latest_report:company_reports!fk_portfolio_companies_latest_report(
            id,
            report_date,
            report_title,
            report_period,
            report_type,
            headline,
            cleaned_content,
            key_highlights,
            metrics,
            processed_at
          )
        `)
        .eq('id', companyId)
        .maybeSingle();

      if (error) throw error;
      return data as PortfolioCompanyWithReport | null;
    },
    enabled: !!companyId,
  });
}
