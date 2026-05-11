import { logger } from "@trigger.dev/sdk";
import { supabase } from "./supabase.js";

/**
 * Déclenche l'analyse IA d'une company en arrière-plan (fire-and-forget).
 * Appelle l'edge function `company-intelligence` qui à son tour invoque l'agent
 * Mastra et écrit le résultat dans `portfolio_companies.ai_analysis`.
 *
 * - Non-bloquant : on log les erreurs mais on ne fait pas échouer le pipeline appelant.
 * - `force_refresh: true` car on appelle à la fin d'un pipeline report, donc on
 *   veut refléter les nouvelles données.
 */
export async function triggerCompanyAnalysis(companyId: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("company-intelligence", {
      body: {
        company_id: companyId,
        mode: "analysis",
        force_refresh: true,
      },
    });
    if (error) {
      logger.warn("Auto-analysis trigger returned error", {
        companyId,
        error: error.message,
      });
      return;
    }
    logger.info("Auto-analysis triggered after report pipeline", { companyId });
  } catch (err) {
    logger.warn("Auto-analysis trigger failed", {
      companyId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
