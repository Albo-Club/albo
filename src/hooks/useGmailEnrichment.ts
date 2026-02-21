import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

/**
 * Enrichit automatiquement les emails portfolio via Gmail search
 * au chargement du workspace. S'exécute une seule fois par workspace par session.
 */
export function useGmailEnrichment() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const enrichedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id || !workspace?.id) return;
    if (enrichedRef.current.has(workspace.id)) return;

    enrichedRef.current.add(workspace.id);

    const timer = setTimeout(async () => {
      try {
        await supabase.functions.invoke('gmail-search', {
          body: { mode: 'match_companies', workspace_id: workspace.id },
        });
      } catch {
        // silent failure
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [user?.id, workspace?.id]);
}
