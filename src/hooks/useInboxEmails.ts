import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmailAttendee {
  display_name: string;
  identifier: string;
}

export interface EmailAttachment {
  id: string;
  name: string;
  extension: string;
  size: number;
  mime: string;
}

export interface UnipileEmail {
  id: string;
  subject: string;
  from: EmailAttendee;
  to: EmailAttendee[];
  cc: EmailAttendee[];
  bcc: EmailAttendee[];
  date: string;
  read: boolean;
  read_date: string | null;
  has_attachments: boolean;
  folders: string[];
  role: string | null;
  is_archived: boolean;
  body: string;
  body_plain: string;
  snippet: string;
  account_id: string;
  account_display_name: string;
  provider: string;
  in_reply_to: any | null;
  message_id: string | null;
  has_cached_detail: boolean;
}

export interface EmailDetailResponse {
  success: boolean;
  source: "cache" | "unipile";
  email: {
    id: string;
    body: string;
    body_plain: string;
    attachments: EmailAttachment[];
  };
  error?: string;
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
  const queryClient = useQueryClient();

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

  // Force refresh function that bypasses cache
  const forceRefresh = async () => {
    const { data, error } = await supabase.functions.invoke<FetchEmailsResponse>(
      'fetch-unipile-emails',
      {
        body: { limit, folder, force_refresh: true },
      }
    );

    if (error) {
      console.error('Error force refreshing emails:', error);
      throw new Error(error.message || 'Failed to refresh emails');
    }

    if (data?.success) {
      // Update the query cache with fresh data
      queryClient.setQueryData(['inbox-emails', limit, folder], data);
    }

    return data;
  };

  return {
    emails: query.data?.emails || [],
    accounts: query.data?.accounts || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    forceRefresh,
    isFetching: query.isFetching,
  };
}

// Hook to fetch email detail on demand
export async function fetchEmailDetail(emailId: string, accountId: string): Promise<EmailDetailResponse> {
  const { data, error } = await supabase.functions.invoke<EmailDetailResponse>(
    'fetch-email-detail',
    {
      body: { email_id: emailId, account_id: accountId },
    }
  );

  if (error) {
    console.error('Error fetching email detail:', error);
    throw new Error(error.message || 'Failed to fetch email detail');
  }

  if (!data) {
    throw new Error('No data received');
  }

  return data;
}
