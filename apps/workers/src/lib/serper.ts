/**
 * Client Serper.dev — recherche Google News + LinkedIn via API
 *
 * Stratégie de recherche :
 * 1. Résolution domaine → titre + description (cacheable, 1 crédit)
 * 2. News avec nom + qualifier sectoriel extrait de la description
 * 3. LinkedIn posts via site:linkedin.com/posts
 */

export interface SerperNewsArticle {
  title: string;
  link: string;
  snippet: string;
  date: string;
  source: string;
  imageUrl?: string;
}

export interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
  position: number;
}

export interface DomainResolution {
  resolvedName: string;
  description: string;
  keywords: string[];
}

const SERPER_BASE = "https://google.serper.dev";

function getApiKey(): string {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error("[serper] SERPER_API_KEY manquant");
  return key;
}

async function serperRequest<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SERPER_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "X-API-KEY": getApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[serper] ${endpoint} HTTP ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Étape 1 : Résoudre le vrai nom et contexte d'une company via son domaine.
 * Extrait 2-3 mots-clés sectoriels de la description pour qualifier les recherches.
 */
export async function resolveDomain(domain: string): Promise<DomainResolution> {
  const data = await serperRequest<{ organic?: SerperOrganicResult[] }>("/search", {
    q: domain,
    gl: "fr",
    hl: "fr",
    num: 1,
  });

  const first = data.organic?.[0];
  if (!first) {
    return { resolvedName: "", description: "", keywords: [] };
  }

  const keywords = extractKeywords(first.snippet || "");

  return {
    resolvedName: cleanTitle(first.title),
    description: first.snippet || "",
    keywords,
  };
}

/**
 * Étape 2 : Recherche news Google via Serper.
 * Utilise le nom exact entre guillemets + qualifier sectoriel pour éviter les homonymes.
 */
export async function fetchNews(
  companyName: string,
  options: {
    qualifier?: string;
    gl?: string;
    hl?: string;
    num?: number;
    tbs?: string;
  } = {}
): Promise<SerperNewsArticle[]> {
  const { qualifier = "", gl = "fr", hl = "fr", num = 5, tbs = "qdr:w" } = options;

  const q = qualifier
    ? `"${companyName}" ${qualifier}`
    : `"${companyName}"`;

  // 1. Essai sur la dernière semaine
  const weekData = await serperRequest<{ news?: SerperNewsArticle[] }>("/news", {
    q,
    gl,
    hl,
    num,
    tbs,
  });

  if (weekData.news && weekData.news.length > 0) {
    return weekData.news;
  }

  // 2. Fallback sur le dernier mois si 0 résultats
  if (tbs === "qdr:w") {
    const monthData = await serperRequest<{ news?: SerperNewsArticle[] }>("/news", {
      q,
      gl,
      hl,
      num,
      tbs: "qdr:m",
    });
    return monthData.news || [];
  }

  return [];
}

/**
 * Étape 3 : Recherche posts LinkedIn via Google site:search.
 */
export async function fetchLinkedInPosts(
  companyName: string,
  options: {
    qualifier?: string;
    gl?: string;
    hl?: string;
    num?: number;
    tbs?: string;
  } = {}
): Promise<SerperOrganicResult[]> {
  const { qualifier = "", gl = "fr", hl = "fr", num = 3, tbs = "qdr:w" } = options;

  const q = qualifier
    ? `site:linkedin.com/posts "${companyName}" ${qualifier}`
    : `site:linkedin.com/posts "${companyName}"`;

  // 1. Essai sur la dernière semaine
  const weekData = await serperRequest<{ organic?: SerperOrganicResult[] }>("/search", {
    q,
    gl,
    hl,
    num,
    tbs,
  });

  if (weekData.organic && weekData.organic.length > 0) {
    return weekData.organic;
  }

  // 2. Fallback sur le dernier mois si 0 résultats
  if (tbs === "qdr:w") {
    const monthData = await serperRequest<{ organic?: SerperOrganicResult[] }>("/search", {
      q,
      gl,
      hl,
      num,
      tbs: "qdr:m",
    });
    return monthData.organic || [];
  }

  return [];
}

// --- Helpers ---

/** Nettoie le titre Google (enlève " - Site Name", " | Tagline", etc.) */
function cleanTitle(title: string): string {
  return title
    .split(/\s*[-|:–—]\s*/)[0]
    .trim();
}

/**
 * Extrait des mots-clés sectoriels d'une description.
 * Exclut les mots vides et garde les termes distinctifs.
 */
const STOP_WORDS = new Set([
  "le", "la", "les", "de", "des", "du", "un", "une", "et", "en", "à", "au", "aux",
  "pour", "par", "sur", "avec", "est", "sont", "qui", "que", "dans", "plus", "pas",
  "nous", "vous", "vos", "nos", "votre", "notre", "leur", "ses", "son", "sa",
  "the", "a", "an", "and", "or", "of", "for", "in", "on", "to", "is", "are", "with",
  "that", "this", "from", "by", "your", "our", "its", "their", "has", "have", "been",
  "can", "will", "all", "each", "every", "how", "we", "you", "it", "they",
]);

function extractKeywords(description: string): string[] {
  const words = description
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));

  // Déduplique et prend les 3 premiers mots distinctifs
  const unique = [...new Set(words)];
  return unique.slice(0, 3);
}
