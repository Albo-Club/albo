import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook pour écouter les nouveaux emails en temps réel via Supabase Realtime.
 * Écoute la table `email_company_matches` pour les nouvelles insertions
 * et invalide le cache React Query pour rafraîchir la liste.
 */
export function useEmailRealtime() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('email-matches-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'email_company_matches',
        },
        (payload) => {
          console.log('📬 New email match via realtime:', payload.new);
          queryClient.invalidateQueries({ queryKey: ['inbox-emails'] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Email realtime subscription status:', status);
      });

    return () => {
      console.log('🔌 Unsubscribing from email realtime');
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}
