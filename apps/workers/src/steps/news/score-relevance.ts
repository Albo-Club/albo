/**
 * Score de pertinence via Claude Haiku.
 * Batch : 1 appel par company (tous les articles d'un coup).
 * Filtre les articles < 0.5 de pertinence.
 */

import { logger } from "@trigger.dev/sdk";
import { getAnthropicClient } from "../../lib/anthropic";
import type { RawNewsItem } from "./fetch-company-news";
import type { DomainResolution } from "../../lib/serper";

export interface ScoredNewsItem extends RawNewsItem {
  relevance_score: number;
}

export async function scoreRelevance(
  companyName: string,
  domain: string,
  resolution: DomainResolution,
  items: RawNewsItem[],
  threshold = 0.5
): Promise<ScoredNewsItem[]> {
  if (items.length === 0) return [];

  const anthropic = getAnthropicClient();

  const articlesList = items
    .map((item, i) => `[${i}] "${item.title}" — ${item.description}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Tu es un filtre de pertinence pour des articles de presse.

Company: "${companyName}"
Domaine: ${domain}
Description: ${resolution.description}

Articles à évaluer :
${articlesList}

Pour chaque article, évalue si il parle bien de CETTE entreprise (pas d'un homonyme).
Retourne UNIQUEMENT un JSON array avec l'index et le score :
[{"i": 0, "s": 0.9}, {"i": 1, "s": 0.1}, ...]

Score 0-1 :
- 1.0 = article clairement sur cette entreprise
- 0.5 = possiblement lié mais incertain
- 0.0 = pas du tout lié (homonyme, sujet différent)

Réponds UNIQUEMENT avec le JSON, sans texte autour.`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  let scores: Array<{ i: number; s: number }>;
  try {
    // Extraire le JSON même s'il y a du texte autour
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Pas de JSON trouvé");
    scores = JSON.parse(jsonMatch[0]);
  } catch (err: any) {
    logger.error(`[score-relevance] Parse failed for ${companyName}:`, { error: err.message });
    // En cas d'erreur de parsing, on garde tout avec score 0.5
    return items.map(item => ({ ...item, relevance_score: 0.5 }));
  }

  // Mapper les scores sur les items et filtrer
  const scored: ScoredNewsItem[] = items.map((item, index) => {
    const found = scores.find(s => s.i === index);
    return { ...item, relevance_score: found?.s ?? 0.5 };
  });

  return scored.filter(item => item.relevance_score >= threshold);
}
