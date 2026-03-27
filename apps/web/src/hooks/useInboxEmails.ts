import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmailAttendee {
  display_name: string;
  identifier: string;
}

export interface MatchedCompany {
  id: string;
  name: string;
  domain: string;
}

export interface EmailOwner {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

export interface UnipileEmail {
  id: string;
  subject: string;
  from: EmailAttendee;
  to: EmailAttendee[];
  cc: EmailAttendee[];
  date: string;
  read: boolean;
  has_attachments: boolean;
  folders: string[];
  role: string | null;
  body: string;
  body_plain: string;
  snippet: string;
  account_id: string;
  account_display_name: string;
  provider: string;
  in_reply_to: any | null;
  message_id: string | null;
  companies: MatchedCompany[];
  owners: EmailOwner[];
  is_potential_report: boolean;
  has_cached_detail: boolean;
}

export interface ConnectedEmailAccount {
  id: string;
  email: string | null;
  display_name: string | null;
  provider: 'GOOGLE' | 'MICROSOFT' | 'IMAP';
  status: 'active' | 'pending' | 'needs_reconnect' | 'disconnected' | 'syncing';
}

interface FetchEmailsParams {
  limit?: number;
}

interface FetchEmailsResponse {
  success: boolean;
  emails: UnipileEmail[];
  accounts: ConnectedEmailAccount[];
  error?: string;
}

export function useInboxEmails(params: FetchEmailsParams = {}) {
  const { limit = 50 } = params;

  const query = useQuery({
    queryKey: ['inbox-emails', limit],
    queryFn: async (): Promise<FetchEmailsResponse> => {
      const { data, error } = await supabase.functions.invoke<FetchEmailsResponse>(
        'fetch-unipile-emails',
        {
          body: { limit },
        }
      );

      if (error) {
        console.error('Error fetching emails:', error);
        throw new Error(error.message || 'Failed to fetch emails');
      }

      if (!data) {
        throw new Error('No data received from email service');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch emails');
      }

      return data;
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    emails: query.data?.emails || [],
    accounts: query.data?.accounts || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}
