/**
 * Step: Extract Extra Sources
 * Scanne l'email pour détecter des sources complémentaires (Notion, etc.)
 * et extrait leur contenu en parallèle du deck principal.
 *
 * Cas typique : un email contient un PDF en PJ + un lien Notion.
 * downloadDeck prend le PDF, extract-extra-sources prend le Notion.
 */

import { extractNotion } from "../extract-notion";

export interface ExtraSource {
  type: "notion";
  url: string;
  markdown: string;
  title: string;
}

export interface ExtraSourcesResult {
  sources: ExtraSource[];
  /** Tout le contenu combiné en markdown (pour l'agent) */
  combinedMarkdown: string;
}

/**
 * Détecte les liens Notion dans le body HTML/texte de l'email
 * et extrait le contenu de chaque page trouvée.
 */
export async function extractExtraSources(
  bodyHtml: string,
  bodyText: string
): Promise<ExtraSourcesResult> {
  const fullContent = bodyHtml + " " + bodyText;
  const sources: ExtraSource[] = [];

  // --- Notion links ---
  const notionUrls = detectNotionLinks(fullContent);
  if (notionUrls.length > 0) {
    console.log(`[extra-sources] ${notionUrls.length} lien(s) Notion détecté(s)`);
  }

  for (const url of notionUrls) {
    try {
      const result = await extractNotion(url);
      sources.push({
        type: "notion",
        url,
        markdown: result.markdown,
        title: result.title,
      });
      console.log(`[extra-sources] Notion OK: "${result.title}" (${result.markdown.length} chars)`);
    } catch (err: any) {
      console.warn(`[extra-sources] Notion extraction échouée pour ${url}: ${err.message}`);
      // On continue — pas bloquant
    }
  }

  // Combiner tout le contenu extrait
  const parts: string[] = [];
  for (const s of sources) {
    parts.push(`## Page Notion : ${s.title}`);
    parts.push(s.markdown);
    parts.push("");
  }

  return {
    sources,
    combinedMarkdown: parts.join("\n"),
  };
}

// --- Détection des liens Notion ---

function detectNotionLinks(content: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  // Pattern 1 : URLs dans href="..."
  const hrefRx = /href=["']([^"']*(?:notion\.so|notion\.site)[^"']*)["']/gi;
  let m;
  while ((m = hrefRx.exec(content)) !== null) {
    const url = cleanNotionUrl(m[1]);
    if (url && !seen.has(url)) {
      seen.add(url);
      results.push(url);
    }
  }

  // Pattern 2 : URLs en texte brut
  const textRx = /https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:notion\.so|notion\.site)\/[^\s<"')]+/gi;
  while ((m = textRx.exec(content)) !== null) {
    const url = cleanNotionUrl(m[0]);
    if (url && !seen.has(url)) {
      seen.add(url);
      results.push(url);
    }
  }

  return results;
}

function cleanNotionUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Exclure les URLs d'API Notion, images, etc.
    if (parsed.pathname.startsWith("/api/")) return null;
    if (parsed.pathname.startsWith("/image")) return null;
    // Doit avoir un path significatif (pas juste /)
    if (parsed.pathname.length < 5) return null;
    return url.split("?")[0].split("#")[0]; // nettoyer query params
  } catch {
    return null;
  }
}
