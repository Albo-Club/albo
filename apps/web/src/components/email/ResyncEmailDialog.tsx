/**
 * 🔄 ResyncEmailDialog
 * Dialog de confirmation pour relancer la synchronisation email.
 * Affiche les domaines non synchronisés depuis la dernière sync.
 */

import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UnsyncedDomain {
  domain: string;
  company_name: string;
  domain_added_at: string;
}

interface ResyncEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  providerAccountId: string;
}

export function ResyncEmailDialog({
  open,
  onOpenChange,
  workspaceId,
  providerAccountId,
}: ResyncEmailDialogProps) {
  const [unsyncedDomains, setUnsyncedDomains] = useState<UnsyncedDomain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (open) {
      loadUnsyncedDomains();
    }
  }, [open, workspaceId]);

  const loadUnsyncedDomains = async () => {
    setLoadingDomains(true);
    try {
      const { data, error } = await supabase
        .from('unsynced_domains_per_workspace')
        .select('domain, company_name, domain_added_at')
        .eq('workspace_id', workspaceId);

      if (error) throw error;
      setUnsyncedDomains((data as UnsyncedDomain[]) || []);
    } catch (error) {
      console.error('Error loading unsynced domains:', error);
      setUnsyncedDomains([]);
    } finally {
      setLoadingDomains(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('start-email-sync', {
        body: { account_id: providerAccountId, fresh: true },
      });

      if (error) throw error;

      toast.success('Synchronisation lancée !', {
        description: 'Vous serez notifié quand elle sera terminée.',
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error starting sync:', error);
      toast.error('Erreur lors du lancement de la synchronisation', {
        description: error.message || 'Veuillez réessayer.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const hasDomains = unsyncedDomains.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Resynchroniser les emails
          </DialogTitle>
          <DialogDescription>
            {loadingDomains
              ? 'Chargement des domaines...'
              : hasDomains
                ? 'Les domaines suivants ont été ajoutés depuis la dernière synchronisation :'
                : 'Tous vos domaines sont déjà synchronisés. Voulez-vous quand même relancer une synchronisation complète ?'}
          </DialogDescription>
        </DialogHeader>

        {loadingDomains ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {hasDomains && (
              <div className="flex flex-wrap gap-2">
                {unsyncedDomains.map((d) => (
                  <Badge
                    key={d.domain}
                    variant="outline"
                    className="bg-amber-50 text-amber-700 border-amber-200"
                  >
                    {d.domain} — {d.company_name}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-lg border bg-muted/50 p-3">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Cette opération va scanner l'intégralité de vos emails pour détecter les
                correspondances avec vos sociétés en portefeuille. Cela peut prendre plusieurs
                minutes.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={syncing}>
            Annuler
          </Button>
          <Button onClick={handleSync} disabled={syncing || loadingDomains}>
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Synchronisation lancée...
              </>
            ) : (
              'Lancer la synchronisation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
