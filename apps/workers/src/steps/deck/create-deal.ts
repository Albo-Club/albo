/**
 * Step: Create Deal
 * 1. INSERT un deal "pending" dans Supabase
 * 2. Après memo HTML généré → PATCH avec les données complètes
 *
 * Reproduit les nœuds N8N "Create Deal1" + "Update with Memo1".
 */

import { supabase } from "../../lib/supabase";
import type { DeckAnalysisResult } from "../../types/deck-analysis";

export interface CreatedDeal {
  dealId: string;
  companyName: string;
}

/**
 * Phase 1 : Crée le deal avec les infos de base extraites par l'agent.
 */
export async function createDeal(
  analysis: DeckAnalysisResult,
  senderEmail: string
): Promise<CreatedDeal> {
  console.log(`[create-deal] Creating deal for: ${analysis.company_name}`);

  const { data, error } = await supabase
    .from("deals")
    .insert({
      company_name: analysis.company_name,
      sender_email: senderEmail,
      source: "email",
      status: "pending",
      sector: analysis.sector,
      sub_sector: analysis.sub_sector,
      funding_type: analysis.funding_type,
      stage: analysis.stage,
      investment_amount_eur: analysis.investment_amount_eur,
      one_liner: analysis.one_liner,
      domain: analysis.domain,
    })
    .select("id, company_name")
    .single();

  if (error) {
    throw new Error(`Erreur création deal: ${error.message}`);
  }

  console.log(`[create-deal] Deal créé: ${data.id}`);
  return { dealId: data.id, companyName: data.company_name };
}

/**
 * Phase 2 : Met à jour le deal avec le memo HTML et le contenu email.
 */
export async function updateDealWithMemo(
  dealId: string,
  memoHtml: string,
  companyName: string,
  mailContent: string,
  additionalContext?: string
): Promise<void> {
  console.log(`[create-deal] Updating deal ${dealId} with memo`);

  const updateData: Record<string, unknown> = {
    analyzed_at: new Date().toISOString(),
    memo_html: memoHtml,
    company_name: companyName,
    status: "A traiter",
    mail_content: mailContent,
  };

  if (additionalContext) {
    updateData.additional_context = additionalContext;
  }

  const { error } = await supabase
    .from("deals")
    .update(updateData)
    .eq("id", dealId);

  if (error) {
    throw new Error(`Erreur PATCH deal: ${error.message}`);
  }

  console.log(`[create-deal] Deal ${dealId} mis à jour avec memo`);
}

/**
 * Phase 3 : Met à jour un deal existant (créé par le frontend) avec TOUS les résultats d'analyse.
 * Utilisé par le pipeline deck-frontend.
 */
export async function updateDealWithAnalysis(
  dealId: string,
  analysis: DeckAnalysisResult,
  memoHtml: string,
  additionalContext?: string
): Promise<void> {
  console.log(`[create-deal] Updating deal ${dealId} with full analysis`);

  const updateData: Record<string, unknown> = {
    analyzed_at: new Date().toISOString(),
    memo_html: memoHtml,
    company_name: analysis.company_name,
    status: "A traiter",
    sector: analysis.sector,
    sub_sector: analysis.sub_sector,
    funding_type: analysis.funding_type,
    stage: analysis.stage,
    investment_amount_eur: analysis.investment_amount_eur,
    one_liner: analysis.one_liner,
    domain: analysis.domain,
  };

  if (additionalContext) {
    updateData.additional_context = additionalContext;
  }

  const { error } = await supabase
    .from("deals")
    .update(updateData)
    .eq("id", dealId);

  if (error) {
    throw new Error(`Erreur PATCH deal (full analysis): ${error.message}`);
  }

  console.log(`[create-deal] Deal ${dealId} mis à jour avec analyse complète`);
}
