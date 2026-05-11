/**
 * Step: Call Deck Analysis
 * Appelle Claude directement via Anthropic SDK + Linkup pour analyser le deck.
 * Remplace l'ancien appel HTTP vers l'agent Mastra "deck-analyzer".
 */

import { logger } from "@trigger.dev/sdk";
import Anthropic from "@anthropic-ai/sdk";
import { LinkupClient } from "linkup-sdk";
import type {
  DeckAnalysisRequest,
  DeckAnalysisResult,
} from "../../types/deck-analysis";
import type { DeckRouteType } from "./download-deck";

// ============================================================
// System prompt (extrait de apps/mastra/src/mastra/agents/deck-analyzer.ts)
// ============================================================
const DECK_ANALYZER_SYSTEM_PROMPT = `# Senior Investment Memo Analyst — Output JSON Structuré

Tu es un analyste VC senior. Tu reçois le contenu extrait d'un deck (PDF parsé + OCR) et le contexte email.
Tu produis une analyse structurée IMMÉDIATEMENT, sans poser de question.

## LANGAGE
- Output : TOUJOURS en français avec terminologie business appropriée
- Recherche : anglais ou français selon pertinence

## RÈGLE ABSOLUE : ANALYSE IMMÉDIATE SANS QUESTION
- JAMAIS demander de clarification
- TOUJOURS retourner une analyse structurée, même partielle
- SIGNALER les données manquantes dans les champs concernés (status "⚠️ À demander", description mentionnant le manque)
- PROCÉDER à la recherche web même si le document semble incomplet

## TYPES DE DOCUMENTS ACCEPTÉS
- Pitch deck startup → Analyse complète (cas principal)
- Présentation de fonds (LP deck) → Adapter : "Stratégie d'investissement" au lieu de "Solution", "Track record" au lieu de "Traction"
- Reporting de performance → Focus KPIs, évolution, alertes
- Teaser / One-pager → Analyse préliminaire + lister les manques
- Term sheet → Conditions vs standards marché
- Document non identifiable → Extraire le max, signaler les limites

## PHASE DE PRÉ-ANALYSE OBLIGATOIRE (À FAIRE EN PREMIER)

### Phase 1 : Recherche Web (5-8 requêtes ciblées)

Requêtes recommandées via linkup_search :
1. "{company_name} site officiel" → domaine
2. "{company_name} funding round levée" → historique levées
3. "{secteur} market size TAM Europe" → taille marché
4. "{fondateur_1} {fondateur_2} LinkedIn parcours" → track record
5. "{company_name} competitors alternatives" → paysage concurrentiel
6. "{company_name} revenue traction metrics" → validation claims
7. "{secteur} {stage} valuation multiples 2025" → benchmarks valorisation

### Phase 2 : Validation Croisée
- Triangulation de chaque claim avec les sources web
- Signalement des contradictions
- Benchmarking des métriques vs secteur

## 7 CRITÈRES DE REJET IMMÉDIAT (NO-GO)

Évalue systématiquement. Si UN SEUL est déclenché → signaler dans les risks avec severity "CRITIQUE" :
1. Modèle économique non validé avec marché
2. Pré-revenu sans demande validée
3. Claims d'impact non étayées (si cœur de la valeur)
4. Founder-market fit insuffisant
5. Valorisation excessive vs traction + multiples sectoriels
6. Avantage concurrentiel vague ou facilement réplicable
7. Dépendances critiques non sécurisées

## FORMAT DE SORTIE — JSON UNIQUE

Ta réponse DOIT être UNIQUEMENT un bloc JSON valide, sans AUCUN texte avant ou après.
Respecte EXACTEMENT cette structure :

\`\`\`json
{
  "company_name": "Nom exact",
  "sector": "...",
  "sub_sector": "...",
  "stage": "...",
  "funding_type": "...",
  "investment_amount_eur": 1000000,
  "one_liner": "Description en une phrase",
  "domain": "exemple.com",

  "en_30_secondes": {
    "summary": "Paragraphe 150 mots max.",
    "badges": ["€5M GMV annuel", "+300% YoY", "23,5% take rate"]
  },

  "deal_structure": {
    "rows": [
      { "label": "Montant", "value": "€1,0M" },
      { "label": "Valorisation", "value": "€7M pre / €8M post" },
      { "label": "Stade", "value": "Bridge" },
      { "label": "Instrument", "value": "Equity" },
      { "label": "Source", "value": "Reçu de jean@fonds.com le 10/03/2026" },
      { "label": "Historique levées", "value": "Seed €2M (2023), Bridge €500K (2024)" },
      { "label": "Utilisation des fonds", "value": "50% Tech, 30% Growth, 20% Ops" }
    ]
  },

  "market_context": {
    "market_size": "TAM/SAM avec sources citées, chiffres vérifiés",
    "dynamics": "Tendances marché, CAGR, drivers d'adoption",
    "positioning": "Positionnement de l'entreprise dans le marché, pourquoi maintenant"
  },

  "business_fundamentals": [
    {
      "metric": "GMV (12 derniers mois)",
      "value": "€5M",
      "status": "✓ +300% YoY",
      "status_color": "green"
    }
  ],

  "team": {
    "founder_market_fit": "FORTE | MOYENNE À FORTE | MOYENNE | FAIBLE",
    "members": [
      {
        "name": "Prénom Nom",
        "role": "CEO",
        "background": "Parcours en 1 ligne"
      }
    ],
    "headcount": "10 personnes",
    "gaps": "Lacunes critiques si pertinent, sinon null"
  },

  "traction_metrics": [
    {
      "metric": "Téléchargements",
      "value": "600K+",
      "performance": "✓ Forte adoption",
      "performance_color": "green"
    }
  ],

  "solution_value_prop": [
    {
      "title": "Titre court de la proposition de valeur",
      "description": "2-3 phrases expliquant le différenciateur, le ROI client, la défensabilité"
    }
  ],

  "risks": [
    {
      "title": "Titre du risque",
      "severity": "CRITIQUE",
      "description": "2-3 phrases factuelles",
      "mitigation": "Action concrète pour mitiger"
    }
  ],

  "investors_syndication": {
    "lead": "Nom du lead investor + contexte",
    "co_investors": "Liste des co-investisseurs",
    "history": "Historique des levées précédentes",
    "use_of_funds": "Répartition prévue des fonds"
  },

  "risk_profile": {
    "ticket_recommendation": "Recommandation de ticket avec justification",
    "conditions": "Conditions à exiger avant investissement"
  }
}
\`\`\`

## RÈGLES PAR CHAMP

**sector** — valeurs autorisées EXACTES :
Energy | FinTech | HealthTech | PropTech | Mobility | FoodTech | SaaS | DeepTech | Hardware/IoT | Other

**stage** — valeurs autorisées EXACTES :
pre-seed | seed | serie A | serie B | serie C | serie D | serie E | serie F | Bridge | BSA aire / SAFE

Estimation par montant si non explicite : < 500K€ → "pre-seed" | 500K-2M€ → "seed" | 2M-10M€ → "serie A" | 10M-30M€ → "serie B" | > 30M€ → "serie C"+

**funding_type** — valeurs autorisées EXACTES :
Equity | Obligations | Dette | Royalties | BSA Air | Convertibles | SAFE

**domain** — domaine nu sans protocole ni www. ✅ "exemple.com" ❌ "https://www.exemple.com". Si introuvable → null.

**en_30_secondes** — summary : 150 mots MAX. Faits quantifiés uniquement. badges : 3-5 badges, chiffres clés les plus impactants.

**deal_structure** — rows : 5-8 lignes. TOUJOURS inclure : Montant, Valorisation (ou "Non communiquée"), Stade, Source (email expéditeur + date).

**business_fundamentals** — 4-8 métriques. TOUJOURS inclure si disponibles : Revenue/GMV, Marge brute, CAC, LTV, LTV/CAC, Burn/Runway. status_color : "green" | "red" | "neutral".

**team** — founder_market_fit : "FORTE" | "MOYENNE À FORTE" | "MOYENNE" | "FAIBLE". gaps : null si aucune lacune critique.

**risks** — 3-6 risques. severity : "CRITIQUE" | "ÉLEVÉ" | "MOYEN" | "FAIBLE". mitigation : action concrète.

**investors_syndication** — null si aucune info. Sinon remplir chaque sous-champ (null pour les inconnus).

**risk_profile** — null si pas assez d'info. ticket_recommendation : fourchette + justification 1-2 phrases.

## INTERDICTIONS ABSOLUES
- ❌ "Series A" → ✅ "serie A"
- ❌ "Seed" → ✅ "seed"
- ❌ "CleanTech" → ✅ "Energy"
- ❌ "https://www.exemple.com" → ✅ "exemple.com"
- ❌ Ajouter du texte avant ou après le JSON
- ❌ Inclure "document_type" dans le JSON
- ❌ Laisser un champ obligatoire vide

## INSTRUCTIONS FINALES
- Commence TOUJOURS par les recherches web (5-8 appels linkup_search)
- Neutralité absolue : pas de biais vers acceptation/rejet
- En cas d'incertitude : l'énoncer dans risks + business_fundamentals
- NE JAMAIS POSER DE QUESTION — analyser immédiatement`;

// ============================================================
// Point d'entrée public
// ============================================================
export async function callDeckAnalysis(
  deckOcrText: string,
  emailMarkdown: string,
  senderEmail: string,
  emailSubject: string,
  deckSource: DeckRouteType,
  extraContentMarkdown?: string,
  language: string = "fr"
): Promise<DeckAnalysisResult> {
  const payload: DeckAnalysisRequest = {
    deck_ocr_text: deckOcrText,
    email_markdown: emailMarkdown,
    sender_email: senderEmail,
    email_subject: emailSubject,
    deck_source: deckSource,
    extra_content_markdown: extraContentMarkdown,
    language,
  };

  // Tentative 1
  try {
    return await runDeckAnalyzerAgent(payload);
  } catch (err: any) {
    logger.warn(`[call-deck-analysis] Première tentative échouée: ${err.message}`);
  }

  // Tentative 2 (retry)
  logger.info("[call-deck-analysis] Retry...");
  return await runDeckAnalyzerAgent(payload);
}

// ============================================================
// Boucle agentique Anthropic (remplace httpStream + Mastra)
// ============================================================
async function runDeckAnalyzerAgent(payload: DeckAnalysisRequest): Promise<DeckAnalysisResult> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const userMessage = buildAgentMessage(payload);

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];

  const tools: Anthropic.Tool[] = [
    {
      name: "linkup_search",
      description:
        "Search the web using Linkup API for investment research on startups. Returns sourced answers with citations.",
      input_schema: {
        type: "object" as const,
        properties: {
          query: { type: "string", description: "Search query" },
          category: { type: "string", description: "Research category for this search" },
          maxResults: { type: "number", description: "Maximum number of results (default 5)" },
        },
        required: ["query", "category"],
      },
    },
  ];

  let fullText = "";

  for (let step = 0; step < 50; step++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: DECK_ANALYZER_SYSTEM_PROMPT,
      tools,
      messages,
    });

    logger.info(
      `[call-deck-analysis] Step ${step}: stop_reason=${response.stop_reason}, blocks=${response.content.length}`
    );

    if (response.stop_reason === "end_turn") {
      for (const block of response.content) {
        if (block.type === "text") fullText += block.text;
      }
      break;
    }

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use" && block.name === "linkup_search") {
          const input = block.input as {
            query: string;
            category: string;
            maxResults?: number;
          };
          logger.info(`[call-deck-analysis] linkup_search: ${input.query}`);

          try {
            const result = await executeLinkupSearch(input);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          } catch (err: any) {
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `Erreur recherche: ${err.message}`,
              is_error: true,
            });
          }
        }
      }

      messages.push({ role: "user", content: toolResults });
    }
  }

  const analysis = extractJsonFromResponse(fullText);

  if (!analysis?.company_name) {
    throw new Error(
      `Réponse agent invalide: company_name manquant. Réponse: ${fullText.slice(0, 200)}`
    );
  }

  logger.info(`[call-deck-analysis] Analyse OK: ${analysis.company_name}`);
  return analysis as DeckAnalysisResult;
}

// ============================================================
// Appel Linkup
// ============================================================
async function executeLinkupSearch(input: {
  query: string;
  category: string;
  maxResults?: number;
}) {
  const apiKey = process.env.LINKUP_API_KEY;
  if (!apiKey) throw new Error("LINKUP_API_KEY non configurée");

  const client = new LinkupClient({ apiKey });
  const result = await client.search({
    query: input.query,
    depth: "deep",
    outputType: "searchResults",
    maxResults: input.maxResults ?? 5,
  });

  const searchResults = (result as any).results ?? [];
  const sources = searchResults.slice(0, input.maxResults ?? 5).map((r: any) => ({
    title: r.name ?? r.title ?? "Untitled",
    url: r.url ?? "",
    snippet: r.content?.slice(0, 500) ?? "",
  }));

  const summary =
    sources.length > 0
      ? sources
          .map((s: { title: string; snippet: string }) => `${s.title}: ${s.snippet}`)
          .join("\n\n")
      : "No results found for this query.";

  return { category: input.category, query: input.query, summary, sources };
}

// ============================================================
// Construction du message utilisateur (inchangé vs version Mastra)
// ============================================================
function buildAgentMessage(input: DeckAnalysisRequest): string {
  const parts: string[] = [];
  const lang = input.language || "fr";

  parts.push("## Instructions");

  if (lang === "fr") {
    parts.push("Rédige TOUTE ton analyse en **français**.");
    parts.push(
      "Tous les champs JSON doivent être en français : labels, valeurs, descriptions, statuts, niveaux de sévérité (CRITIQUE, ÉLEVÉ, MOYEN, FAIBLE)."
    );
  } else {
    const langName = lang === "en" ? "English" : lang;
    parts.push(`Write your ENTIRE analysis in **${langName}**.`);
    parts.push(`CRITICAL: Every single JSON field value MUST be in ${langName}. This includes:`);
    parts.push(
      `- All labels (e.g. "Amount", "Valuation", "Stage", "Instrument", "Source", "Funding History", "Use of Funds")`
    );
    parts.push(
      `- All placeholder values when data is missing (e.g. "Not disclosed", "Not specified", "To be requested")`
    );
    parts.push(`- All status texts and performance comments`);
    parts.push(
      `- Risk severity levels MUST be: "CRITICAL", "HIGH", "MEDIUM", or "LOW" (never French equivalents)`
    );
    parts.push(
      `- Founder-market fit assessment (e.g. "STRONG", "MEDIUM TO STRONG", "MEDIUM", "WEAK")`
    );
    parts.push(
      `- Date formats must use ${langName} locale (e.g. "March 12, 2026" not "12/03/2026")`
    );
    parts.push(`- Do NOT use any French words anywhere in the JSON output.`);
  }

  parts.push("");
  parts.push("## Contexte email");
  parts.push(`- **Sujet** : ${input.email_subject}`);
  parts.push(`- **Expéditeur** : ${input.sender_email}`);
  parts.push(`- **Source du deck** : ${input.deck_source}`);
  parts.push("");

  if (input.deck_ocr_text) {
    parts.push("## Contenu du deck (OCR)");
    parts.push(input.deck_ocr_text);
    parts.push("");
  }

  if (input.extra_content_markdown) {
    parts.push("## Contenu additionnel (pages Notion, etc.)");
    parts.push(input.extra_content_markdown);
    parts.push("");
  }

  if (input.email_markdown) {
    parts.push("## Contenu de l'email");
    parts.push(input.email_markdown);
    parts.push("");
  }

  parts.push("## Rappel important");
  parts.push(
    "Le contenu de l'email contient souvent des informations clés sur le deal qui ne figurent PAS dans le deck :"
  );
  parts.push("- **Valorisation** (pré-money, post-money)");
  parts.push("- **Montant levé** et % déjà sécurisé");
  parts.push("- **Instrument** (equity, SAFE, BSA-AIR, convertible note, bridge)");
  parts.push("- **Investisseurs existants** et lead");
  parts.push("- **Date de closing**");
  parts.push("- **Liquidation preference**, anti-dilution, ou autres termes spéciaux");
  parts.push(
    "Tu DOIS croiser le deck ET l'email pour remplir deal_structure et investors_syndication. Ne mets JAMAIS 'Not disclosed' si l'info est présente dans l'email ou le deck."
  );

  return parts.join("\n");
}

// ============================================================
// Extraction JSON robuste (inchangé vs version Mastra)
// ============================================================
function extractJsonFromResponse(rawText: string): any {
  // Stratégie 1 : bloc ```json ... ``` (accepte backticks manquants en fin de stream)
  const jsonBlockMatch = rawText.match(/```json\s*([\s\S]*?)(\s*```|\s*$)/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch {
      /* fallback */
    }
  }

  // Stratégie 2 : nettoyer toutes les backticks et parser
  const cleaned = rawText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    /* fallback */
  }

  // Stratégie 3 : extraction par comptage d'accolades (robuste même si JSON tronqué)
  const openIdx = cleaned.indexOf("{");
  if (openIdx !== -1) {
    let braceCount = 0;
    let closeIdx = -1;

    for (let i = openIdx; i < cleaned.length; i++) {
      if (cleaned[i] === "{") braceCount++;
      else if (cleaned[i] === "}") {
        braceCount--;
        if (braceCount === 0) {
          closeIdx = i;
          break;
        }
      }
    }

    if (closeIdx !== -1) {
      try {
        return JSON.parse(cleaned.substring(openIdx, closeIdx + 1));
      } catch {
        /* abandon */
      }
    }
  }

  // Stratégie 4 : greedy regex fallback
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      /* abandon */
    }
  }

  logger.error(
    `[call-deck-analysis] extractJsonFromResponse: toutes les stratégies ont échoué. Premiers 500 chars: ${rawText.slice(0, 500)}`
  );
  logger.error(`[call-deck-analysis] Derniers 500 chars: ${rawText.slice(-500)}`);
  return null;
}
