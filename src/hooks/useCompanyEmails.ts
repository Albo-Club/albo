import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CompanyEmail {
  id: string;
  account_id: string;
  subject: string;
  from: {
    display_name?: string;
    identifier: string;
  };
  to: Array<{
    display_name?: string;
    identifier: string;
  }>;
  date: string | null;
  has_attachments: boolean;
  matched_domain: string;
  body: string;
  body_plain: string;
  snippet: string;
  read: boolean;
  folders: string[];
  cc: Array<{
    display_name?: string;
    identifier: string;
  }>;
}

interface FetchCompanyEmailsResponse {
  success: boolean;
  emails: CompanyEmail[];
  total: number;
  company: {
    id: string;
    name: string;
    domain: string | null;
  };
  pagination: {
    limit: number;
    offset: number;
    has_more: boolean;
  };
  error?: string;
}

interface UseCompanyEmailsParams {
  companyId: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

export function useCompanyEmails({ 
  companyId, 
  limit = 50, 
  offset = 0,
  enabled = true 
}: UseCompanyEmailsParams) {
  const query = useQuery({
    queryKey: ['company-emails', companyId, limit, offset],
    queryFn: async (): Promise<FetchCompanyEmailsResponse> => {
      const { data, error } = await supabase.functions.invoke<FetchCompanyEmailsResponse>(
        'fetch-company-emails',
        {
          body: { company_id: companyId, limit, offset },
        }
      );

      if (error) {
        console.error('Error fetching company emails:', error);
        throw new Error(error.message || 'Failed to fetch company emails');
      }

      if (!data) {
        throw new Error('No data received from company emails service');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch company emails');
      }

      return data;
    },
    enabled: enabled && !!companyId,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
  });

  return {
    emails: query.data?.emails || [],
    total: query.data?.total || 0,
    company: query.data?.company,
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}
