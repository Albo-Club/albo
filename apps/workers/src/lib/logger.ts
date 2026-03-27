/**
 * Pipeline Logger
 * Logger structuré qui écrit dans pipeline_logs (Supabase).
 * Un logger par exécution, contexte mutable (sender/subject remplis après parseEmail).
 */

import { supabase } from "./supabase";

export interface PipelineContext {
  runId: string;
  pipeline: "report" | "deck" | "deck-frontend" | "email-sync" | "user-signup";
  senderEmail?: string;
  emailSubject?: string;
  unipileEmailId?: string;
  profileId?: string;
}

export type PipelineLogger = ((step: string, level: string, message: string) => Promise<void>) & {
  ctx: PipelineContext;
};

export function createPipelineLogger(ctx: PipelineContext): PipelineLogger {
  const log = async (step: string, level: string, message: string) => {
    try {
      await supabase.from("pipeline_logs").insert({
        run_id: ctx.runId,
        pipeline: ctx.pipeline,
        step,
        level,
        message,
        sender_email: ctx.senderEmail || null,
        email_subject: ctx.emailSubject || null,
        unipile_email_id: ctx.unipileEmailId || null,
        profile_id: ctx.profileId || null,
      });
    } catch {
      // Ne pas casser le pipeline pour un log
    }
  };

  log.ctx = ctx;
  return log as PipelineLogger;
}
