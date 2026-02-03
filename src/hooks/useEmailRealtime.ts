import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook pour écouter les nouveaux emails en temps réel via Supabase Realtime.
 * Quand un nouvel email est inséré dans la table `emails`, 
 * on invalide le cache React Query pour rafraîchir la liste.
 */
export function useEmailRealtime() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    // S'abonner aux INSERT sur la table emails pour cet utilisateur
    const channel = supabase
      .channel('emails-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'emails',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('📬 Nouvel email reçu via realtime:', payload.new);
          
          // Invalider le cache pour rafraîchir la liste des emails
          queryClient.invalidateQueries({ queryKey: ['inbox-emails'] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Email realtime subscription status:', status);
      });

    // Cleanup : se désabonner quand le composant se démonte
    return () => {
      console.log('🔌 Unsubscribing from emails realtime');
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}
