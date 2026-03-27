import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PipelineRun {
  run_id: string;
  pipeline: string;
  sender_email: string | null;
  email_subject: string | null;
  profile_id: string | null;
  unipile_email_id: string | null;
  started_at: string;
  duration_s: number;
  step_count: number;
  status: string;
  error_message: string | null;
  company_match: string | null;
}

export interface PipelineStep {
  step: string;
  level: string;
  message: string;
  created_at: string;
}

export function usePipelineLogs() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [isLoadingSteps, setIsLoadingSteps] = useState(false);

  const fetchRuns = useCallback(async (pipeline: string | null, days: number) => {
    setIsLoadingRuns(true);
    const { data, error } = await supabase.rpc("get_pipeline_runs", {
      p_pipeline: pipeline,
      p_days: days,
      p_limit: 50,
    } as any);
    if (!error && data) setRuns(data as unknown as PipelineRun[]);
    setIsLoadingRuns(false);
  }, []);

  const fetchSteps = useCallback(async (runId: string) => {
    setIsLoadingSteps(true);
    const { data, error } = await supabase
      .from("pipeline_logs" as any)
      .select("step, level, message, created_at")
      .eq("run_id", runId)
      .order("created_at", { ascending: true });
    if (!error && data) setSteps(data as unknown as PipelineStep[]);
    setIsLoadingSteps(false);
  }, []);

  return { runs, steps, isLoadingRuns, isLoadingSteps, fetchRuns, fetchSteps };
}
