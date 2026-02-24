import { useEffect, useState, useCallback } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ImportJob {
  id: string;
  status: string;
  file_name: string;
  progress: {
    current_batch?: number;
    total_batches?: number;
    companies_processed?: number;
    failed_batches?: number;
  } | null;
  result: {
    summary?: { total: number; successful: number; failed: number; updated?: number };
    results?: unknown[];
  } | null;
  error: string | null;
}

export function ImportProgressBanner() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [job, setJob] = useState<ImportJob | null>(null);
  const [visible, setVisible] = useState(false);

  const fetchJob = useCallback(async () => {
    if (!workspace?.id) return null;

    const { data } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('workspace_id', workspace.id)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1);

    return (data && data.length > 0) ? data[0] as unknown as ImportJob : null;
  }, [workspace?.id]);

  useEffect(() => {
    if (!workspace?.id) return;

    let intervalId: ReturnType<typeof setInterval>;
    let mounted = true;

    const poll = async () => {
      const activeJob = await fetchJob();

      if (!mounted) return;

      if (activeJob) {
        setJob(activeJob);
        setVisible(true);
      } else if (job && (job.status === 'pending' || job.status === 'processing')) {
        // Job disappeared from active — check if it completed
        const { data } = await supabase
          .from('import_jobs')
          .select('*')
          .eq('id', job.id)
          .single();

        if (!mounted) return;

        const finishedJob = data as unknown as ImportJob | null;

        if (finishedJob?.status === 'completed') {
          const summary = finishedJob.result?.summary;
          toast.success(
            `Import terminé ! ${summary?.successful ?? 0} entreprise(s) créée(s)${summary?.updated ? `, ${summary.updated} mise(s) à jour` : ''}`
          );
          queryClient.invalidateQueries({ queryKey: ['portfolio-companies'] });
          setJob(null);
          setVisible(false);
        } else if (finishedJob?.status === 'failed') {
          toast.error("L'import a échoué", {
            description: finishedJob.error || 'Erreur inconnue',
          });
          setJob(null);
          setVisible(false);
        }

        clearInterval(intervalId);
        return;
      }
    };

    poll();
    intervalId = setInterval(poll, 5000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [workspace?.id, fetchJob, job?.id]);

  if (!visible || !job) return null;

  const progress = job.progress;
  const currentBatch = progress?.current_batch ?? 0;
  const totalBatches = progress?.total_batches ?? 1;
  const companiesProcessed = progress?.companies_processed ?? 0;
  const progressPercent = totalBatches > 0 ? Math.round((currentBatch / totalBatches) * 100) : 0;

  return (
    <Alert className="border-primary/20 bg-primary/5">
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <AlertDescription className="text-sm text-foreground">
            Import du portfolio en cours...
            {totalBatches > 1 && (
              <span className="text-muted-foreground ml-1">
                (batch {currentBatch}/{totalBatches} — {companiesProcessed} entreprises traitées)
              </span>
            )}
          </AlertDescription>
          {totalBatches > 1 && (
            <Progress value={progressPercent} className="mt-2 h-1.5" />
          )}
        </div>
      </div>
    </Alert>
  );
}
