import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { UnipileEmail } from './useInboxEmails';

interface EmailAttendee {
  display_name?: string;
  identifier: string;
}

interface CompanyEmailMatch {
  id: string;
  unipile_email_id: string;
  unipile_account_id: string;
  email_date: string;
  email_subject: string | null;
  email_from: EmailAttendee | null;
  email_to: EmailAttendee[] | null;
  has_attachments: boolean;
  matched_domain: string;
  created_at: string;
}

export function useCompanyEmails(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company-emails', companyId],
    queryFn: async (): Promise<UnipileEmail[]> => {
      if (!companyId) return [];

      // Fetch from email_company_matches table directly (metadata only)
      const { data, error } = await supabase
        .from('email_company_matches')
        .select('*')
        .eq('company_id', companyId)
        .order('email_date', { ascending: false });

      if (error) throw error;

      // Transform to UnipileEmail format (metadata only, no body)
      return (data || []).map((match: CompanyEmailMatch): UnipileEmail => {
        // Ensure from has required display_name
        const fromAttendee = match.email_from 
          ? { display_name: match.email_from.display_name || match.email_from.identifier || 'Inconnu', identifier: match.email_from.identifier }
          : { display_name: 'Inconnu', identifier: '' };
        
        // Ensure to array items have required display_name
        const toAttendees = (match.email_to || []).map(t => ({
          display_name: t.display_name || t.identifier || 'Inconnu',
          identifier: t.identifier
        }));

        return {
          id: match.unipile_email_id,
          subject: match.email_subject || '(Sans sujet)',
          from: fromAttendee,
          to: toAttendees,
          cc: [],
          date: match.email_date,
          read: true,
          has_attachments: match.has_attachments || false,
          folders: [],
          role: null,
          body: '',
          body_plain: '',
          snippet: '',
          account_id: match.unipile_account_id,
          account_display_name: '',
          provider: '',
          in_reply_to: null,
          message_id: null,
          companies: [],
          owners: [],
          is_potential_report: false,
          has_cached_detail: false,
        };
      });
    },
    enabled: !!companyId,
    staleTime: 60 * 1000, // 1 minute
  });
}
