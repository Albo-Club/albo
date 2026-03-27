/**
 * Step: Extract structured metrics from any document using Claude Haiku
 * Takes the text representation of a document (Excel, PDF, image OCR) and returns structured metrics.
 */

import { logger } from "@trigger.dev/sdk";
import { getAnthropicClient } from "../lib/anthropic";

export interface ExtractedMetric {
  metric_key: string;
  metric_value: string;
  metric_type: "currency" | "percentage" | "number" | "months" | "ratio" | "text";
  report_period: string;
}

const SYSTEM_PROMPT = `Tu es un analyste financier expert.
Extrais TOUTES les métriques quantitatives d'un document financier (Excel, PDF, image/screenshot).

Règles :
- Extrais chaque donnée chiffrée avec sa clé en snake_case anglais (ex: revenue, arr, mrr, ebitda, cash_position, burn_rate, churn_rate, customers, employees, runway_months, gross_margin, net_income, total_expenses, cac, ltv, arpu, gmv)
- metric_type: "currency" pour les montants, "percentage" pour les %, "number" pour les compteurs, "months" pour les durées, "ratio" pour les ratios
- metric_value: nombre brut (pas de symbole €/$/%, pas d'espaces). Pourcentages en décimal (15% → 0.15)
- report_period: la période à laquelle la donnée se rapporte (ex: "February 2026", "Q4 2025", "2025"). Utilise le format anglais.
- Si une même métrique apparaît pour plusieurs périodes (ex: tableau mensuel), extrais chaque occurrence séparément
- Ignore les labels, headers, noms de colonnes — ne garde que les données chiffrées significatives
- Ignore les sous-totaux redondants si le total est présent
- Maximum 100 métriques par document
- Si le document ne contient aucune donnée chiffrée exploitable, retourne un array vide []

Réponds UNIQUEMENT avec un JSON array, sans markdown, sans explication.
Exemple: [{"metric_key":"revenue","metric_value":"150000","metric_type":"currency","report_period":"January 2026"}]`;

/**
 * Extract metrics from any document text (Excel, PDF OCR, image OCR).
 * Backward-compatible: exported as both extractDocumentMetrics and extractExcelMetrics.
 */
export async function extractDocumentMetrics(
  documentText: string,
  fallbackPeriod: string
): Promise<ExtractedMetric[]> {
  if (!documentText || documentText.length < 20) return [];

  // Tronquer si trop long (Haiku context = 200k mais on veut être économe)
  const truncated = documentText.length > 30000 ? documentText.slice(0, 30000) + "\n[...tronqué]" : documentText;

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16384,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `Période du document si non détectable dans les données : ${fallbackPeriod}\n\nContenu du document :\n${truncated}`,
    }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";

  const jsonStr = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
  const metrics = parseJsonWithRecovery(jsonStr);

  if (metrics.length === 0) return [];

  // Valider et nettoyer
  const valid = metrics.filter((m) =>
    m.metric_key && m.metric_value && m.metric_type && m.report_period &&
    typeof m.metric_key === "string" && typeof m.metric_value === "string"
  ).map((m) => ({
    metric_key: m.metric_key.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_"),
    metric_value: String(m.metric_value).replace(/[€$%\s,]/g, ""),
    metric_type: m.metric_type,
    report_period: m.report_period,
  }));

  logger.info(`[extract-document-metrics] Extracted ${valid.length} metrics via Claude Haiku`);
  return valid;
}

/** @deprecated Use extractDocumentMetrics instead */
export const extractExcelMetrics = extractDocumentMetrics;

/**
 * Parse JSON array with recovery for truncated responses.
 * If JSON.parse fails, find the last complete object `}` and close the array.
 */
function parseJsonWithRecovery(jsonStr: string): ExtractedMetric[] {
  // Try normal parse first
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Truncated JSON — try to recover valid entries
  }

  // Find last complete object: look for "}" pattern
  const lastCompleteIdx = jsonStr.lastIndexOf("}");
  if (lastCompleteIdx < 0) {
    logger.error(`[extract-excel-metrics] No recoverable JSON found`);
    logger.error(`[extract-excel-metrics] Raw: ${jsonStr.slice(0, 200)}`);
    return [];
  }

  const recovered = jsonStr.slice(0, lastCompleteIdx + 1) + "]";
  try {
    const parsed = JSON.parse(recovered);
    if (Array.isArray(parsed)) {
      logger.warn(`[extract-excel-metrics] Recovered ${parsed.length} metrics from truncated JSON`);
      return parsed;
    }
  } catch {
    // Still broken — try one level back
    const secondLastIdx = jsonStr.lastIndexOf("}", lastCompleteIdx - 1);
    if (secondLastIdx > 0) {
      try {
        const parsed2 = JSON.parse(jsonStr.slice(0, secondLastIdx + 1) + "]");
        if (Array.isArray(parsed2)) {
          logger.warn(`[extract-excel-metrics] Recovered ${parsed2.length} metrics (2nd attempt)`);
          return parsed2;
        }
      } catch { /* give up */ }
    }
  }

  logger.error(`[extract-excel-metrics] JSON recovery failed`);
  logger.error(`[extract-excel-metrics] Raw: ${jsonStr.slice(0, 200)}`);
  return [];
}
