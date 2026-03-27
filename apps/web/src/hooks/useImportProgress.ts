import { useState, useEffect, useCallback, useRef } from 'react';
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
    companies_created?: number;
    companies_updated?: number;
  } | null;
  result: {
    summary?: { total: number; successful: number; failed: number; updated?: number };
  } | null;
  error: string | null;
}

export function useImportProgress() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [job, setJob] = useState<ImportJob | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const lastJobIdRef = useRef<string | null>(null);

  const poll = useCallback(async () => {
    if (!workspace?.id) return;

    const { data } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('workspace_id', workspace.id)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const activeJob = data[0] as unknown as ImportJob;
      setJob(activeJob);
      setIsComplete(false);
      lastJobIdRef.current = activeJob.id;
    } else if (lastJobIdRef.current) {
      // Job just disappeared from active — check final state
      const { data: finalJob } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('id', lastJobIdRef.current)
        .single();

      const finished = finalJob as unknown as ImportJob | null;
      lastJobIdRef.current = null;

      if (finished?.status === 'completed') {
        setJob(finished);
        setIsComplete(true);
        const count = finished.progress?.companies_processed ?? finished.result?.summary?.successful ?? 0;
        toast.success(`Import terminé ! ${count} sociétés importées`);
        queryClient.invalidateQueries({ queryKey: ['portfolio-companies'] });
        setTimeout(() => {
          setJob(null);
          setIsComplete(false);
        }, 4000);
      } else if (finished?.status === 'failed') {
        toast.error(`Import échoué : ${finished.error || 'Erreur inconnue'}`);
        setJob(null);
      } else {
        setJob(null);
      }
    }
  }, [workspace?.id, queryClient]);

  useEffect(() => {
    if (!workspace?.id) return;
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [workspace?.id, poll]);

  return { job, isComplete };
}
