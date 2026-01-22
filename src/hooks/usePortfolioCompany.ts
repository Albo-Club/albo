import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PortfolioCompany } from './usePortfolioCompanies';

export function usePortfolioCompany(companyId: string | undefined) {
  return useQuery({
    queryKey: ['portfolio-company', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const { data, error } = await supabase
        .from('portfolio_companies')
        .select('*')
        .eq('id', companyId)
        .maybeSingle();

      if (error) throw error;
      return data as PortfolioCompany | null;
    },
    enabled: !!companyId,
  });
}
