/**
 * Fetch news + LinkedIn posts pour une company via Serper.
 * Utilise le domaine pour résoudre le contexte et qualifier la recherche.
 */

import {
  resolveDomain,
  fetchNews,
  fetchLinkedInPosts,
  type SerperNewsArticle,
  type SerperOrganicResult,
  type DomainResolution,
} from "../../lib/serper";

export interface CompanyNewsInput {
  company_id: string;
  company_name: string;
  domain: string;
  workspace_id: string;
}

export interface RawNewsItem {
  title: string;
  description: string;
  source_name: string;
  source_url: string;
  image_url: string | null;
  published_at: string | null;
  source_type: "news" | "linkedin";
}

export interface FetchResult {
  company_id: string;
  resolution: DomainResolution;
  items: RawNewsItem[];
}

export async function fetchCompanyNews(input: CompanyNewsInput): Promise<FetchResult> {
  // 1. Résolution domaine → contexte sectoriel
  const resolution = await resolveDomain(input.domain);
  const qualifier = resolution.keywords.join(" ");

  // 2. Fetch news presse (max 5)
  let newsArticles: SerperNewsArticle[] = [];
  try {
    newsArticles = await fetchNews(input.company_name, { qualifier, num: 5 });
  } catch (err: any) {
    console.error(`[fetch-company-news] News failed for ${input.company_name}:`, err.message);
  }

  // 3. Fetch LinkedIn posts (max 3)
  let linkedinPosts: SerperOrganicResult[] = [];
  try {
    linkedinPosts = await fetchLinkedInPosts(input.company_name, { qualifier, num: 3 });
  } catch (err: any) {
    console.error(`[fetch-company-news] LinkedIn failed for ${input.company_name}:`, err.message);
  }

  // 4. Normaliser en format unifié
  const newsItems: RawNewsItem[] = newsArticles.map(a => ({
    title: a.title,
    description: a.snippet || "",
    source_name: a.source,
    source_url: a.link,
    image_url: a.imageUrl || null,
    published_at: parseSerperDate(a.date),
    source_type: "news" as const,
  }));

  const linkedinItems: RawNewsItem[] = linkedinPosts.map(p => ({
    title: cleanLinkedInTitle(p.title),
    description: p.snippet || "",
    source_name: "LinkedIn",
    source_url: p.link,
    image_url: null,
    published_at: parseSerperDate(p.date || null),
    source_type: "linkedin" as const,
  }));

  return {
    company_id: input.company_id,
    resolution,
    items: [...newsItems, ...linkedinItems],
  };
}

/** Parse les dates relatives Serper ("il y a 2 jours", "3 weeks ago", "15 sept. 2025") */
function parseSerperDate(dateStr: string | null): string | null {
  if (!dateStr) return null;

  const now = new Date();

  // "il y a X heures/jours/semaines/mois"
  const frMatch = dateStr.match(/il y a (\d+) (heure|jour|semaine|mois)/i);
  if (frMatch) {
    const n = parseInt(frMatch[1]);
    const unit = frMatch[2].toLowerCase();
    if (unit.startsWith("heure")) now.setHours(now.getHours() - n);
    else if (unit.startsWith("jour")) now.setDate(now.getDate() - n);
    else if (unit.startsWith("semaine")) now.setDate(now.getDate() - n * 7);
    else if (unit.startsWith("mois")) now.setMonth(now.getMonth() - n);
    return now.toISOString();
  }

  // "X hours/days/weeks/months ago"
  const enMatch = dateStr.match(/(\d+) (hour|day|week|month)s? ago/i);
  if (enMatch) {
    const n = parseInt(enMatch[1]);
    const unit = enMatch[2].toLowerCase();
    if (unit === "hour") now.setHours(now.getHours() - n);
    else if (unit === "day") now.setDate(now.getDate() - n);
    else if (unit === "week") now.setDate(now.getDate() - n * 7);
    else if (unit === "month") now.setMonth(now.getMonth() - n);
    return now.toISOString();
  }

  // "Il y a X jours" (capitalized)
  const frMatch2 = dateStr.match(/Il y a (\d+) (jour|semaine|mois)/i);
  if (frMatch2) {
    const n = parseInt(frMatch2[1]);
    const unit = frMatch2[2].toLowerCase();
    if (unit.startsWith("jour")) now.setDate(now.getDate() - n);
    else if (unit.startsWith("semaine")) now.setDate(now.getDate() - n * 7);
    else if (unit.startsWith("mois")) now.setMonth(now.getMonth() - n);
    return now.toISOString();
  }

  // Date absolue : essaye un parse direct
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();

  // Format français "15 sept. 2025"
  const frAbsolute = dateStr.match(/(\d{1,2})\s+(\w+)\.?\s+(\d{4})/);
  if (frAbsolute) {
    const months: Record<string, number> = {
      janv: 0, févr: 1, mars: 2, avr: 3, mai: 4, juin: 5,
      juil: 6, août: 7, sept: 8, oct: 9, nov: 10, déc: 11,
    };
    const day = parseInt(frAbsolute[1]);
    const monthKey = frAbsolute[2].toLowerCase().replace(".", "");
    const year = parseInt(frAbsolute[3]);
    const month = months[monthKey];
    if (month !== undefined) {
      return new Date(year, month, day).toISOString();
    }
  }

  return null;
}

/** Nettoie les titres LinkedIn (enlève les hashtags et suffixes) */
function cleanLinkedInTitle(title: string): string {
  return title
    .replace(/#\w+/g, "")
    .replace(/\s*\|\s*.*$/, "")
    .replace(/'s Post$/, "")
    .replace(/Post de\s*/, "")
    .trim();
}
