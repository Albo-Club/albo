import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

/**
 * useGmailEnrichment
 * 
 * Se déclenche automatiquement quand :
 * 1. L'user est connecté (session active)
 * 2. Le workspace actif est chargé
 * 3. L'user a un gmail_token actif
 * 
 * Appelle la Edge Function gmail-search en mode match_companies
 * avec le workspace_id actif pour enrichir les emails portfolio.
 * 
 * Throttle : max 1 appel par session (via ref) pour ne pas spammer.
 */
export function useGmailEnrichment() {
  const { session } = useAuth();
  const { workspace } = useWorkspace();
  const enrichedWorkspaces = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!session?.access_token || !workspace?.id) return;
    if (enrichedWorkspaces.current.has(workspace.id)) return;

    const runEnrichment = async () => {
      try {
        enrichedWorkspaces.current.add(workspace.id);

        console.log(`[GmailEnrichment] Starting for workspace "${workspace.name}" (${workspace.id})`);

        const { data, error } = await supabase.functions.invoke('gmail-search', {
          body: {
            mode: 'match_companies',
            workspace_id: workspace.id,
            persist: true,
          },
        });

        if (error) {
          console.log('[GmailEnrichment] Skipped:', error.message);
          return;
        }

        const summary = data?.summary;
        if (summary) {
          console.log(
            `[GmailEnrichment] ✓ Done — ${summary.companies_searched} companies searched, ` +
            `${summary.total_inserted} new emails inserted, ` +
            `${summary.total_skipped_duplicates} duplicates skipped`
          );
        }
      } catch (err) {
        console.error('[GmailEnrichment] Error:', err);
      }
    };

    const timer = setTimeout(runEnrichment, 3000);
    return () => clearTimeout(timer);
  }, [session?.access_token, workspace?.id]);
}
