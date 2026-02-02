import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmailAttendee {
  display_name: string;
  identifier: string;
}

export interface UnipileEmail {
  id: string;
  subject: string;
  from: EmailAttendee;
  to: EmailAttendee[];
  cc: EmailAttendee[];
  date: string;
  read: boolean;
  read_date: string | null;
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
  folder?: string;
}

interface FetchEmailsResponse {
  success: boolean;
  emails: UnipileEmail[];
  accounts: ConnectedEmailAccount[];
  error?: string;
}

export function useInboxEmails(params: FetchEmailsParams = {}) {
  const { limit = 50, folder = 'INBOX' } = params;

  const query = useQuery({
    queryKey: ['inbox-emails', limit, folder],
    queryFn: async (): Promise<FetchEmailsResponse> => {
      const { data, error } = await supabase.functions.invoke<FetchEmailsResponse>(
        'fetch-unipile-emails',
        {
          body: { limit, folder },
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
    staleTime: 30 * 1000, // 30 seconds
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
