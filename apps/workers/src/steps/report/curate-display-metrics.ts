/**
 * Step: Curate Display Metrics (v2 — VC Partner View)
 *
 * Uses Haiku to read ALL raw metrics for a company and produce clean graph series
 * with actual vs projection classification. Output in portfolio_companies.display_metrics.
 *
 * Signals for actual vs projection:
 * - source = "report" → almost always actual
 * - source = "document_upload" + document name contains "BP"/"Business Plan" → projection source
 * - period_sort_date far in the future (>= today + 6 months) from BP docs → projection
 * - report_period containing "Budget"/"Forecast"/"Target" → projection
 * - Historical data even from BP docs (past dates) → actual (BP often includes historical)
 */

import { getAnthropicClient } from "../../lib/anthropic.js";
import { supabase } from "../../lib/supabase.js";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

const log = {
  info: (...args: any[]) => console.log("[curate-metrics]", ...args),
  error: (...args: any[]) => console.error("[curate-metrics]", ...args),
};

const TODAY = new Date().toISOString().slice(0, 10);

const CURATION_PROMPT = `Tu es un analyste senior dans un fonds de VC. Tu prépares le dashboard d'un partner pour qu'il voie EN UN INSTANT la trajectoire de chaque investissement.

Chaque graphique doit montrer :
- La **performance réalisée** (actual) — extraite des reporting trimestriels/mensuels
- Les **projections** (projection) — issues du Business Plan ou deck, si disponibles

Le partner veut voir si la boîte délivre par rapport à ce qui était prévu, et la tendance qui se dégage.

## Règles strictes

1. **Déduplique** les métriques qui désignent la même chose sous des noms différents (revenue, total_revenue, ca_total → une seule série "Revenue")
2. **Classifie chaque data point** :
   - \`"type": "actual"\` = chiffres réalisés, confirmés par un report opérationnel
   - \`"type": "projection"\` = prévisions issues d'un BP, deck, budget ou forecast
3. **Signaux pour classifier** :
   - source=report → presque toujours actual (sauf si report_period contient "Budget"/"Forecast"/"Target")
   - source=document_upload + document nommé BP/Business Plan/Prévisionnel → projection (même pour les dates passées : les données du BP représentent le plan, pas les réalisés)
   - report_period contenant "Budget", "Forecast", "Target", "Objectif" → projection
   - Dates très futures (2027+) depuis un document_upload → projection
4. **NORMALISATION DES ÉCHELLES** — C'est CRITIQUE. Les BP sont souvent en K€ (milliers) alors que les reports sont en € (unités). Pour chaque série qui mélange actual et projection :
   - Compare les ordres de grandeur des actuals vs projections pour des périodes proches
   - Si les projections sont ~1000x plus petites que les actuals → le BP est en K€ → multiplie les projections par 1000
   - Si les projections sont ~1000x plus grandes → le BP est en K€ et les reports en unités → divise les projections par 1000
   - L'objectif : TOUTES les valeurs d'une série doivent être dans la même unité pour que le graphe soit lisible
   - En cas de doute, aligne sur l'échelle des actuals (reports) qui sont la référence fiable
5. **NORMALISATION DE LA GRANULARITÉ** — AUSSI CRITIQUE. Les BP donnent des chiffres annuels, les reports des chiffres mensuels. Mélanger les deux crée des zigzags absurdes.
   - Pour les **métriques de flux** (revenue, EBITDA, gross_margin, net_income, burn, opex, cogs — tout ce qui s'accumule sur une période) :
     - Si les actuals sont mensuels et les projections annuelles → NE PAS mettre les deux dans la même série
     - Crée UNE série avec les actuals mensuels (type=actual)
     - Les projections annuelles ne sont PAS comparables mois par mois → exclus-les de cette série
   - Pour les **métriques de stock** (AUM, cash, headcount, users, clients, ARR/MRR — valeur à un instant T) :
     - Actuals mensuels et projections annuelles PEUVENT coexister car ce sont des snapshots
     - Les projections annuelles sont des objectifs fin d'année
   - En résumé : JAMAIS de chiffre annuel de flux (ex: revenue annuelle BP = 2M) à côté de chiffres mensuels de flux (ex: revenue mensuelle report = 200K) sur le même graphe
6. **Infère l'année** si elle manque : "Q4" dans un report daté "February 2026" → "Q4 2025"
7. **Trie** chaque série par date croissante
8. **Max 8 séries** les plus stratégiques pour un VC. Priorise : Revenue/ARR/MRR, Cash/Runway, Burn Rate, Headcount, Margin/EBITDA, Customers/Users, CAC/LTV, AUM
9. **Une seule valeur par type par période** — un actual ET une projection pour la même période c'est OK pour les métriques de stock. Si doublon du même type, garde la source la plus fiable (report > document_upload pour les actuals)
10. **Ignore** les métriques qui n'ont qu'un seul point de données (pas de tendance visible)
11. **source_report_id** peut être null. Conserve-le tel quel (null ou uuid)

## Catégories disponibles
revenue, profitability, cash, growth, clients, team, fund

## Format de sortie (JSON strict)

{
  "graphs": [
    {
      "key": "revenue",
      "label": "Revenue",
      "category": "revenue",
      "unit": "EUR",
      "data": [
        { "period": "Q1 2025", "value": 120000, "type": "actual", "sort_date": "2025-01-01", "source_report_id": "uuid..." },
        { "period": "Q1 2025", "value": 150000, "type": "projection", "sort_date": "2025-01-01", "source_report_id": null },
        { "period": "Q2 2025", "value": 155000, "type": "actual", "sort_date": "2025-04-01", "source_report_id": "uuid..." },
        { "period": "Q3 2025", "value": 200000, "type": "projection", "sort_date": "2025-07-01", "source_report_id": null }
      ]
    }
  ]
}

Réponds UNIQUEMENT avec le JSON, sans commentaire ni markdown.`;

export async function curateDisplayMetrics(companyId: string): Promise<void> {
  // 1. Fetch ALL raw metrics (report + document_upload) — no date cutoff, projections welcome
  const { data: rawMetrics, error: fetchError } = await supabase
    .from("portfolio_company_metrics")
    .select("metric_key, canonical_key, metric_value, metric_type, metric_category, report_period, period_sort_date, source_report_id, source, source_document_id")
    .eq("company_id", companyId)
    .order("period_sort_date", { ascending: true });

  if (fetchError) {
    log.error("Failed to fetch raw metrics", fetchError.message);
    return;
  }

  if (!rawMetrics || rawMetrics.length === 0) {
    log.info("No metrics to curate", companyId);
    return;
  }

  // Pre-filter: only keep canonical_keys with 2+ entries, cap at top 30 keys by frequency
  const countByKey = new Map<string, number>();
  for (const m of rawMetrics) {
    const key = m.canonical_key || m.metric_key;
    countByKey.set(key, (countByKey.get(key) || 0) + 1);
  }

  // Keep keys with 2+ points, sorted by frequency (most data points first)
  // Dynamic cap: reduce keys if too many data points (avoids max_tokens on Haiku response)
  const sorted = [...countByKey.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);

  let keysCap = 30;
  const totalTop30 = sorted.slice(0, 30).reduce((s, [, c]) => s + c, 0);
  if (totalTop30 > 300) keysCap = 10;
  else if (totalTop30 > 200) keysCap = 15;

  const eligibleKeys = sorted.slice(0, keysCap).map(([key]) => key);

  const eligibleSet = new Set(eligibleKeys);
  const filteredMetrics = rawMetrics.filter((m) => {
    const key = m.canonical_key || m.metric_key;
    return eligibleSet.has(key);
  });

  if (filteredMetrics.length === 0) {
    log.info("No metrics with 2+ data points", companyId);
    return;
  }

  log.info(`${rawMetrics.length} raw → ${filteredMetrics.length} filtered (top ${eligibleKeys.length} keys)`);

  // 2. Fetch report context + document names for source classification
  const { data: reports } = await supabase
    .from("company_reports")
    .select("id, report_period, report_date, created_at")
    .eq("company_id", companyId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(20);

  const reportsContext = (reports || [])
    .map((r) => `- Report ${r.id}: period="${r.report_period}", date=${r.report_date || r.created_at}`)
    .join("\n");

  // Fetch document names for document_upload metrics (to identify BPs/decks)
  const docIds = [...new Set(filteredMetrics.filter((m) => m.source_document_id).map((m) => m.source_document_id!))];
  const docNameMap = new Map<string, string>();
  if (docIds.length > 0) {
    const { data: docs } = await supabase
      .from("portfolio_documents")
      .select("id, original_file_name")
      .in("id", docIds);
    for (const d of docs || []) {
      docNameMap.set(d.id, d.original_file_name || "unknown");
    }
  }

  // 3. Format metrics — compact format with source info for actual/projection classification
  const metricsText = filteredMetrics
    .map((m) => {
      const docName = m.source_document_id ? (docNameMap.get(m.source_document_id) || "") : "";
      return `${m.canonical_key || m.metric_key}|${m.metric_value}|${m.report_period}|${m.period_sort_date}|${m.metric_category}|${m.source || "report"}|${docName}|${m.source_report_id || "null"}`;
    })
    .join("\n");

  // 4. Call Haiku
  const userMessage = `## Date du jour : ${TODAY}\n\n## Reports de cette société\n${reportsContext}\n\n## Métriques (${filteredMetrics.length} lignes, format: key|value|period|sort_date|category|source|document_name|report_id)\n${metricsText}`;

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 8192,
      messages: [
        { role: "user", content: `${CURATION_PROMPT}\n\n${userMessage}` },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    log.info(`Haiku response: ${text.length} chars, stop_reason: ${response.stop_reason}`);

    // 5. Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log.error("Haiku returned no valid JSON:", text.slice(0, 500));
      return;
    }

    const displayMetrics = JSON.parse(jsonMatch[0]);

    // Basic validation
    if (!displayMetrics.graphs || !Array.isArray(displayMetrics.graphs)) {
      log.error("Haiku returned invalid structure:", Object.keys(displayMetrics));
      return;
    }

    // 6. Store in portfolio_companies.display_metrics
    const { error: updateError } = await supabase
      .from("portfolio_companies")
      .update({ display_metrics: displayMetrics })
      .eq("id", companyId);

    if (updateError) {
      log.error("Failed to store display_metrics:", updateError.message);
    } else {
      const seriesCount = displayMetrics.graphs.length;
      const totalPoints = displayMetrics.graphs.reduce(
        (sum: number, g: any) => sum + (g.data?.length || 0), 0
      );
      log.info(`Curated ${seriesCount} graph series (${totalPoints} data points) for ${companyId}`);
    }
  } catch (err: any) {
    log.error("Haiku curation failed:", err.message, companyId);
  }
}
