import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface PortfolioCompany {
  id: string;
  workspace_id: string;
  company_name: string;
  sector: string | null; // Legacy field for backward compatibility
  sectors: string[] | null; // New multi-sector field
  domain: string | null;
  preview: string | null;
  logo_url: string | null;
  amount_invested_cents: number | null;
  investment_date: string | null;
  investment_type: string | null;
  ownership_percentage: number | null;
  entry_valuation_cents: number | null;
  last_news: string | null;
  last_news_updated_at: string | null;
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
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('company_name');

      if (error) throw error;
      return data as PortfolioCompany[];
    },
    enabled: !!workspace?.id,
  });
}
