import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface EmailAttachment {
  id: string;
  filename: string;
  content_type: string;
  size: number;
}

export interface EmailDetail {
  body_html: string | null;
  body_plain: string | null;
  attachments: EmailAttachment[];
  is_pending?: boolean;
}

interface FetchEmailDetailResponse {
  success: boolean;
  source?: 'cache' | 'unipile' | 'pending';
  email?: {
    id?: string;
    body?: string;
    body_plain?: string;
    attachments?: EmailAttachment[];
    is_pending?: boolean;
  };
  error?: string;
}

export function useEmailDetail(emailId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['email-detail', emailId],
    queryFn: async (): Promise<EmailDetail> => {
      if (!emailId) {
        throw new Error('Email ID is required');
      }

      const { data, error } = await supabase.functions.invoke<FetchEmailDetailResponse>(
        'fetch-email-detail',
        {
          body: { email_id: emailId },
        }
      );

      if (error) {
        console.error('Error fetching email detail:', error);
        throw new Error(error.message || 'Failed to fetch email detail');
      }

      if (!data) {
        throw new Error('No data received from email detail service');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch email detail');
      }

      const emailData = data.email;
      const isPending = data.source === 'pending' || emailData?.is_pending === true;

      // Map API response fields to our interface (name→filename, mime→content_type)
      const mappedAttachments: EmailAttachment[] = (emailData?.attachments || []).map((att: any) => ({
        id: att.id,
        filename: att.name || att.filename || 'unknown',
        content_type: att.mime || att.content_type || 'application/octet-stream',
        size: att.size || 0,
      }));

      return {
        body_html: emailData?.body || null,
        body_plain: emailData?.body_plain || null,
        attachments: mappedAttachments,
        is_pending: isPending,
      };
    },
    enabled: !!emailId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Auto-retry if pending
  useEffect(() => {
    if (query.data?.is_pending && !query.isFetching) {
      const timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['email-detail', emailId] });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [query.data?.is_pending, query.isFetching, emailId, queryClient]);

  return {
    detail: query.data,
    isLoading: query.isLoading,
    error: query.error,
    isPending: query.data?.is_pending ?? false,
    retry: () => query.refetch(),
  };
}
