import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useRef, useState } from 'react';

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

const MAX_PENDING_RETRIES = 3;
const RETRY_INTERVAL_MS = 3000;

export function useEmailDetail(emailId: string | undefined) {
  const queryClient = useQueryClient();
  const retryCountRef = useRef(0);
  const [gaveUp, setGaveUp] = useState(false);

  // Reset quand on change d'email
  useEffect(() => {
    retryCountRef.current = 0;
    setGaveUp(false);
  }, [emailId]);

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
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Auto-retry si pending, max 3 fois
  useEffect(() => {
    if (query.data?.is_pending && !query.isFetching && !gaveUp) {
      if (retryCountRef.current >= MAX_PENDING_RETRIES) {
        console.log(`[useEmailDetail] Max retries (${MAX_PENDING_RETRIES}) reached for ${emailId}, giving up`);
        setGaveUp(true);
        return;
      }

      const timer = setTimeout(() => {
        retryCountRef.current += 1;
        console.log(`[useEmailDetail] Retry ${retryCountRef.current}/${MAX_PENDING_RETRIES} for ${emailId}`);
        queryClient.invalidateQueries({ queryKey: ['email-detail', emailId] });
      }, RETRY_INTERVAL_MS);

      return () => clearTimeout(timer);
    }
  }, [query.data?.is_pending, query.isFetching, emailId, queryClient, gaveUp]);

  return {
    detail: query.data,
    isLoading: query.isLoading,
    error: query.error,
    // isPending est false quand on a abandonné
    isPending: (query.data?.is_pending ?? false) && !gaveUp,
    gaveUp,
    retry: () => {
      retryCountRef.current = 0;
      setGaveUp(false);
      query.refetch();
    },
  };
}

// Export pour le prefetch
export async function fetchEmailDetailFn(emailId: string): Promise<EmailDetail | null> {
  const { data } = await supabase.functions.invoke<FetchEmailDetailResponse>(
    'fetch-email-detail',
    { body: { email_id: emailId } }
  );
  
  if (!data?.success || !data.email) return null;
  
  const emailData = data.email;
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
    is_pending: data.source === 'pending' || emailData?.is_pending === true,
  };
}
