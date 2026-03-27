import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook pour écouter les nouveaux matches email-company en temps réel.
 */
export function useCompanyEmailsRealtime(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || !companyId) return;

    const channel = supabase
      .channel(`company-emails-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'email_company_matches',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('📬 Nouvel email matché pour la company:', payload.new);
          queryClient.invalidateQueries({ queryKey: ['company-emails', companyId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, companyId, queryClient]);
}
