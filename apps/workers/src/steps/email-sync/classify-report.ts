/**
 * Step: Classify Report (Haiku)
 *
 * Pré-filtre sémantique : Haiku décide si un email est un vrai
 * "investor update / reporting investisseur" ou autre chose
 * (email opérationnel, reçu, newsletter marketing, correspondance interne).
 *
 * Appelé APRÈS le scoring keyword (qui élimine déjà ~90% des non-reports)
 * et AVANT le pipeline report (qui coûte ~10x plus cher en tokens Sonnet).
 *
 * Coût estimé : ~0.001$/email (Haiku, ~500 tokens in + ~50 out)
 */

import { logger } from "@trigger.dev/sdk";
import { getAnthropicClient } from "../../lib/anthropic.js";

export interface ClassificationResult {
  isInvestorReport: boolean;
  contentType: string;
  reason: string;
}

const SYSTEM_PROMPT = `Tu es un classificateur d'emails pour un fonds d'investissement (VC/BA).

Ta seule tâche : déterminer si un email est un **reporting investisseur** (investor update, rapport d'activité destiné aux actionnaires/investisseurs) ou autre chose.

Exemples de VRAIS reports investisseurs :
- "Investor Update February 2026" avec KPIs, métriques, highlights
- "Reporting Investisseurs - Mars 2026" avec CA, MRR, trésorerie
- "Quarterly Report Q4 2025" avec résumé exécutif et métriques
- "Note actionnaire Janvier" avec point d'activité et chiffres

Exemples de NON-reports (à rejeter) :
- Emails opérationnels internes ("Reporting semaine 8", "MPS", "Recap fournisseur")
- Reçus et factures ("Receipt from Koust", "Bon de commande")
- Newsletters marketing ("LRD News #October", "Newsletter clients")
- Correspondance juridique ("Contrat de placement", "Accord fondateurs")
- Bilans carbone, audits techniques, rapports techniques internes
- Articles ou rapports externes partagés ("Global Impact Report 2024")

Réponds UNIQUEMENT en JSON :
{
  "is_investor_report": true/false,
  "content_type": "investor_report" | "internal_operational" | "receipt_invoice" | "marketing_newsletter" | "legal_correspondence" | "external_article" | "technical_report" | "other",
  "reason": "explication courte en français"
}`;

function buildUserPrompt(subject: string, fromEmail: string, bodyPreview: string): string {
  return `Sujet : ${subject || "(vide)"}
De : ${fromEmail || "(inconnu)"}
Début du contenu :
${bodyPreview}`;
}

/**
 * Classifie un email via Haiku.
 * Retourne { isInvestorReport, contentType, reason }.
 * En cas d'erreur API → retourne isInvestorReport=true (fail-open pour ne pas perdre de vrais reports).
 */
export async function classifyReport(
  subject: string | null,
  fromEmail: string | null,
  bodyHtml: string | null,
  bodyPlain: string | null
): Promise<ClassificationResult> {
  // Extraire un preview du body (plain préféré, sinon strip HTML)
  let preview = bodyPlain || "";
  if (!preview && bodyHtml) {
    preview = bodyHtml
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  // Limiter à 800 chars (suffisant pour Haiku, économise tokens)
  preview = preview.substring(0, 800);

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserPrompt(subject || "", fromEmail || "", preview),
        },
      ],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const json = JSON.parse(text);

    return {
      isInvestorReport: json.is_investor_report === true,
      contentType: json.content_type || "other",
      reason: json.reason || "",
    };
  } catch (err: any) {
    // Fail-open : en cas d'erreur, on laisse passer (mieux vaut un faux positif qu'un report perdu)
    logger.error(`[classify-report] Erreur Haiku: ${err.message}`);
    return {
      isInvestorReport: true,
      contentType: "unknown_error",
      reason: `Erreur classification: ${err.message}`,
    };
  }
}
