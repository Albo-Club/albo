/**
 * Step: Call Deck Analysis
 * Appelle l'agent Mastra "deck-analyzer" pour analyser le deck.
 *
 * Mode local  : appelle directement http://localhost:4111 (MASTRA_API_URL)
 * Mode prod   : appelle l'edge function Supabase qui relay vers Mastra Cloud
 *
 * Retry 1 fois en cas d'échec.
 */

import { logger } from "@trigger.dev/sdk";
import https from "node:https";
import http from "node:http";
import type {
  DeckAnalysisRequest,
  DeckAnalysisResult,
} from "../../types/deck-analysis";
import type { DeckRouteType } from "./download-deck";

// Mastra Cloud en prod, localhost en dev
const MASTRA_API_URL = () => (process.env.MASTRA_API_URL || "http://localhost:4111").trim();
const MASTRA_ACCESS_TOKEN = () => (process.env.MASTRA_ACCESS_TOKEN || "").trim();

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
    return await callMastraAgent(payload);
  } catch (err: any) {
    logger.warn(`[call-deck-analysis] Première tentative échouée: ${err.message}`);
  }

  // Tentative 2 (retry)
  logger.info("[call-deck-analysis] Retry...");
  return await callMastraAgent(payload);
}

async function callMastraAgent(payload: DeckAnalysisRequest): Promise<DeckAnalysisResult> {
  const baseUrl = MASTRA_API_URL();
  // Utilise /stream au lieu de /generate — Cloudflare coupe les connexions longues sans streaming
  const url = `${baseUrl}/api/agents/deck-analyzer/stream`;

  logger.info(`[call-deck-analysis] POST ${url} (stream)`);

  const userMessage = buildAgentMessage(payload);

  const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
  const token = MASTRA_ACCESS_TOKEN();
  if (token) {
    reqHeaders["Authorization"] = `Bearer ${token}`;
    reqHeaders["x-mastra-access-token"] = token;
  }

  const bodyStr = JSON.stringify({
    messages: [{ role: "user", content: userMessage }],
  });

  // Stream la réponse et accumule les chunks text
  const rawText = await httpStream(url, reqHeaders, bodyStr);

  const analysis = extractJsonFromResponse(rawText);

  if (!analysis || !analysis.company_name) {
    throw new Error(
      `Réponse agent invalide: company_name manquant. Réponse: ${rawText.slice(0, 200)}`
    );
  }

  logger.info(`[call-deck-analysis] Analyse OK: ${analysis.company_name}`);
  return analysis as DeckAnalysisResult;
}

function buildAgentMessage(input: DeckAnalysisRequest): string {
  const parts: string[] = [];

  const lang = input.language || "fr";

  parts.push("## Instructions");

  if (lang === "fr") {
    parts.push("Rédige TOUTE ton analyse en **français**.");
    parts.push("Tous les champs JSON doivent être en français : labels, valeurs, descriptions, statuts, niveaux de sévérité (CRITIQUE, ÉLEVÉ, MOYEN, FAIBLE).");
  } else {
    const langName = lang === "en" ? "English" : lang;
    parts.push(`Write your ENTIRE analysis in **${langName}**.`);
    parts.push(`CRITICAL: Every single JSON field value MUST be in ${langName}. This includes:`);
    parts.push(`- All labels (e.g. "Amount", "Valuation", "Stage", "Instrument", "Source", "Funding History", "Use of Funds")`);
    parts.push(`- All placeholder values when data is missing (e.g. "Not disclosed", "Not specified", "To be requested")`);
    parts.push(`- All status texts and performance comments`);
    parts.push(`- Risk severity levels MUST be: "CRITICAL", "HIGH", "MEDIUM", or "LOW" (never French equivalents)`);
    parts.push(`- Founder-market fit assessment (e.g. "STRONG", "MEDIUM TO STRONG", "MEDIUM", "WEAK")`);
    parts.push(`- Date formats must use ${langName} locale (e.g. "March 12, 2026" not "12/03/2026")`);
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
  parts.push("Le contenu de l'email contient souvent des informations clés sur le deal qui ne figurent PAS dans le deck :");
  parts.push("- **Valorisation** (pré-money, post-money)");
  parts.push("- **Montant levé** et % déjà sécurisé");
  parts.push("- **Instrument** (equity, SAFE, BSA-AIR, convertible note, bridge)");
  parts.push("- **Investisseurs existants** et lead");
  parts.push("- **Date de closing**");
  parts.push("- **Liquidation preference**, anti-dilution, ou autres termes spéciaux");
  parts.push("Tu DOIS croiser le deck ET l'email pour remplir deal_structure et investors_syndication. Ne mets JAMAIS 'Not disclosed' si l'info est présente dans l'email ou le deck.");

  return parts.join("\n");
}

/**
 * POST SSE stream via https/http natif.
 * Accumule les chunks de texte de l'agent Mastra et retourne le texte final.
 * Le streaming garde la connexion Cloudflare vivante (pas de timeout 100s).
 */
function httpStream(
  url: string,
  headers: Record<string, string>,
  body: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const req = mod.request(
      url,
      { method: "POST", headers, timeout: 300_000 },
      (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          let errBody = "";
          res.on("data", (chunk) => (errBody += chunk));
          res.on("end", () => reject(new Error(`Mastra ${res.statusCode}: ${errBody.slice(0, 300)}`)));
          return;
        }

        let fullText = "";
        let buffer = "";

        res.on("data", (chunk) => {
          buffer += chunk.toString();

          // Parse SSE events line by line
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // garder le dernier fragment incomplet

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data);
              // Format Mastra SSE : { type: "text-delta", payload: { text: "..." } }
              if (event?.type === "text-delta" && event?.payload?.text) {
                fullText += event.payload.text;
              }
            } catch {
              // Chunk non-JSON, ignorer
            }
          }
        });

        res.on("end", () => {
          logger.info(`[call-deck-analysis] Stream terminé: ${fullText.length} chars`);
          resolve(fullText);
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Mastra stream timeout (300s)"));
    });
    req.write(body);
    req.end();
  });
}

function extractJsonFromResponse(rawText: string): any {
  // Stratégie 1 : bloc ```json ... ``` (accepte backticks manquants en fin de stream)
  const jsonBlockMatch = rawText.match(/```json\s*([\s\S]*?)(\s*```|\s*$)/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch { /* fallback */ }
  }

  // Stratégie 2 : nettoyer toutes les backticks et parser
  const cleaned = rawText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch { /* fallback */ }

  // Stratégie 3 : extraction par comptage d'accolades (robuste même si JSON tronqué dans le texte)
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
      const jsonStr = cleaned.substring(openIdx, closeIdx + 1);
      try {
        return JSON.parse(jsonStr);
      } catch { /* abandon */ }
    }
  }

  // Stratégie 4 : greedy regex fallback (dernier recours)
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch { /* abandon */ }
  }

  logger.error(`[call-deck-analysis] extractJsonFromResponse: toutes les stratégies ont échoué. Premiers 500 chars: ${rawText.slice(0, 500)}`);
  logger.error(`[call-deck-analysis] Derniers 500 chars: ${rawText.slice(-500)}`);
  return null;
}
