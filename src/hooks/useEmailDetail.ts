import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
}

interface FetchEmailDetailResponse {
  success: boolean;
  source?: 'cache' | 'unipile' | 'unipile_partial' | 'no_content' | 'not_found';
  email?: {
    id?: string;
    body?: string;
    body_plain?: string;
    attachments?: EmailAttachment[];
  };
  error?: string;
}

export function useEmailDetail(emailId: string | undefined, accountId?: string) {
  const query = useQuery({
    queryKey: ['email-detail', emailId, accountId],
    queryFn: async (): Promise<EmailDetail> => {
      if (!emailId) {
        throw new Error('Email ID is required');
      }

      const { data, error } = await supabase.functions.invoke<FetchEmailDetailResponse>(
        'fetch-email-detail',
        {
          body: { 
            email_id: emailId,
            account_id: accountId,
          },
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
      };
    },
    enabled: !!emailId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    detail: query.data,
    isLoading: query.isLoading,
    error: query.error,
    retry: () => query.refetch(),
  };
}

// Export pour le prefetch
export async function fetchEmailDetailFn(emailId: string, accountId?: string): Promise<EmailDetail | null> {
  const { data } = await supabase.functions.invoke<FetchEmailDetailResponse>(
    'fetch-email-detail',
    { body: { email_id: emailId, account_id: accountId } }
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
  };
}
