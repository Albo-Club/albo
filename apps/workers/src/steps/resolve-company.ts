/**
 * Step: Resolve Company
 *
 * Logique workspace-aware en 2 passes :
 *
 * Pass 1 (précis) — pour chaque workspace (owner > admin > member) :
 *   1a. nom extrait du sujet → ilike sur portfolio_companies
 *   1b. domaine extrait du body → eq sur portfolio_companies.domain
 *
 * Pass 2 (fuzzy) — si rien trouvé en pass 1 :
 *   2a. chercher si un nom de company du workspace apparaît dans subject+body
 *        (word boundary, min 3 chars)
 *
 * Garantie : un user ne voit que les companies de ses workspaces.
 */

import { supabase } from "../lib/supabase";

export interface ResolvedCompany {
  found: boolean;
  companyId: string | null;
  companyName: string | null;
  workspaceId: string | null;
  domain: string | null;
  matchedBy: string;
  profileId: string | null;
}

const IGNORE_DOMAINS = new Set([
  "gmail.com", "outlook.com", "yahoo.com", "hotmail.com",
  "icloud.com", "googlemail.com", "alboteam.com", "morning.fr",
]);

const ROLE_PRIORITY: Record<string, number> = { owner: 0, admin: 1, member: 2 };

// Mots parasites dans les sujets qui polluent l'extraction du nom de company
const SUBJECT_NOISE_WORDS = [
  "update", "message", "reporting", "report", "confidentiel", "confidential",
  "monthly", "quarterly", "annual", "weekly", "bimonthly",
  "newsletter", "news", "bilan", "performances", "ambitions", "draft",
  "investors", "investisseurs", "actionnaires", "shareholders",
  "rapport", "gestion", "activité", "information",
  "au", "aux", "du", "de", "des", "la", "le", "les", "d", "l", "n", "et",
  "fwd", "fw", "re", "tr",
  "q1", "q2", "q3", "q4",
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
  "2024", "2025", "2026", "2027",
];

// Noms de plateformes/services à exclure du body_mention matching
// Ces mots apparaissent dans les signatures et footers mais ne sont pas des portfolio companies
const BODY_MENTION_BLOCKLIST = new Set([
  "linkedin", "twitter", "facebook", "instagram", "youtube",
  "google", "microsoft", "apple", "amazon", "slack", "zoom",
  "notion", "github", "stripe", "hubspot", "salesforce",
]);

function extractCompanyDomain(bodyText: string, senderEmail: string): string | null {
  const senderDomain = senderEmail.split("@")[1]?.toLowerCase();
  const emailRegex = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
  const allEmails = bodyText.match(emailRegex) || [];

  for (const email of allEmails) {
    const domain = email.split("@")[1]?.toLowerCase();
    if (domain && !IGNORE_DOMAINS.has(domain) && domain !== senderDomain) {
      return domain;
    }
  }
  return null;
}

/**
 * Extrait le nom de company depuis le sujet.
 * Retourne plusieurs candidats (du plus précis au plus court).
 * Ex: "Fwd: Update Caeli - Confidentiel" → ["Caeli"]
 * Ex: "Fwd: EUTOPIA CO INVEST DYNAMO | REPORTING Q4 2025" → ["EUTOPIA CO INVEST DYNAMO"]
 */
function extractCompanyNamesFromSubject(subject: string): string[] {
  // Nettoyage de base
  let cleaned = subject
    .replace(/^(Fwd:|Re:|Fw:|Tr:)\s*/gi, "")
    .replace(/[-–—|·:]/g, " ")       // inclut les deux-points (ex: "Confidential: Marble")
    .replace(/['']/g, " ")           // apostrophes → espaces (pour que "d'activité" devienne "d activité")
    .replace(/\d{2}\/\d{2}/g, "")
    .trim();

  // Supprimer les mots parasites
  const noiseRx = new RegExp(
    `\\b(${SUBJECT_NOISE_WORDS.join("|")})\\b`,
    "gi"
  );
  cleaned = cleaned.replace(noiseRx, " ").replace(/\s+/g, " ").trim();

  if (cleaned.length < 2) return [];

  // Candidat 1 : le nom complet nettoyé (max 4 mots)
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
  const candidates: string[] = [];

  if (words.length > 0) {
    candidates.push(words.slice(0, 4).join(" ").trim());
  }
  // Candidat 2 : premier mot seul (si différent)
  if (words.length > 1 && words[0].length >= 3) {
    candidates.push(words[0]);
  }

  return candidates.filter((c) => c.length >= 2);
}

interface Membership {
  workspace_id: string;
  role: string;
}

interface CompanyRow {
  id: string;
  company_name: string;
  domain: string | null;
  workspace_id: string;
}

export async function resolveCompany(
  senderEmail: string,
  subject: string,
  bodyText: string
): Promise<ResolvedCompany> {
  const companyDomain = extractCompanyDomain(bodyText, senderEmail);
  const companyNames = extractCompanyNamesFromSubject(subject);
  // Nettoyer le texte pour le body_mention matching :
  // supprimer adresses email et URLs pour éviter les faux positifs (ex: "alboteam" dans report@alboteam.com)
  const rawText = `${subject}\n${bodyText}`.toLowerCase();
  const fullText = rawText
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "")   // strip emails
    .replace(/https?:\/\/[^\s]+/g, "");           // strip URLs

  console.log(`[resolve-company] sender=${senderEmail}, domain=${companyDomain}, names=${JSON.stringify(companyNames)}`);

  // Step 1: Trouver le profile du sender
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, name")
    .eq("email", senderEmail)
    .maybeSingle();

  if (!profile) {
    console.log(`[resolve-company] Aucun profile trouvé pour ${senderEmail}`);
    return notFound(null);
  }

  const profileId = profile.id;
  console.log(`[resolve-company] Profile: ${profile.name} (${profileId})`);

  // Step 2: Lister ses workspaces triés par rôle
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", profileId);

  if (!memberships || memberships.length === 0) {
    console.log(`[resolve-company] Aucun workspace pour ${senderEmail}`);
    return notFound(profileId);
  }

  const sorted = memberships.sort(
    (a, b) => (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99)
  );

  console.log(`[resolve-company] ${sorted.length} workspaces: ${sorted.map((w) => `${w.workspace_id} (${w.role})`).join(", ")}`);

  // ===== PASS 1 : matching précis =====
  // Boucle nom → workspace (pas workspace → nom) pour prioriser le nom le plus précis
  // "Sant Roch" dans CALTE doit gagner contre "Sant" → "Versant" dans Albo 1
  for (const name of companyNames) {
    for (const ws of sorted) {
      const match = await matchByName(ws, name);
      if (match) return { ...match, profileId };
    }
  }
  // Puis essayer par domaine
  if (companyDomain) {
    for (const ws of sorted) {
      const match = await matchByDomain(ws, companyDomain);
      if (match) return { ...match, profileId };
    }
  }

  // ===== PASS 2 : body_mention — collecter TOUS les matchs, garder le plus spécifique =====
  const allMentions: { company: CompanyRow; role: string; nameLen: number }[] = [];

  for (const ws of sorted) {
    const mentions = await collectBodyMentions(ws, fullText);
    allMentions.push(...mentions);
  }

  if (allMentions.length > 0) {
    // Prioriser : 1) nom le plus long (plus spécifique), 2) à rôle égal, admin > member
    allMentions.sort((a, b) => {
      if (b.nameLen !== a.nameLen) return b.nameLen - a.nameLen;
      return (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99);
    });

    const best = allMentions[0];
    console.log(`[resolve-company] PASS2 best body_mention: "${best.company.company_name}" (${best.nameLen} chars, ${best.role}) — ${allMentions.length} candidats`);
    return { ...found(best.company, `body_mention_${best.role}`), profileId };
  }

  console.log("[resolve-company] Company non trouvée dans aucun workspace");
  return notFound(profileId);
}

async function matchByName(ws: Membership, name: string): Promise<ResolvedCompany | null> {
  const { data } = await supabase
    .from("portfolio_companies")
    .select("id, company_name, domain, workspace_id")
    .eq("workspace_id", ws.workspace_id)
    .ilike("company_name", `%${name}%`)
    .limit(1)
    .maybeSingle();

  if (data) {
    console.log(`[resolve-company] PASS1 nom "${name}" → "${data.company_name}" (${ws.role})`);
    return found(data, `subject_name_${ws.role}`);
  }
  return null;
}

async function matchByDomain(ws: Membership, domain: string): Promise<ResolvedCompany | null> {
  const { data } = await supabase
    .from("portfolio_companies")
    .select("id, company_name, domain, workspace_id")
    .eq("workspace_id", ws.workspace_id)
    .eq("domain", domain)
    .limit(1)
    .maybeSingle();

  if (data) {
    console.log(`[resolve-company] PASS1 domaine "${domain}" → "${data.company_name}" (${ws.role})`);
    return found(data, `domain_${ws.role}`);
  }
  return null;
}

/** Pass 2 : collecter toutes les mentions de companies dans le texte */
async function collectBodyMentions(
  ws: Membership,
  fullText: string
): Promise<{ company: CompanyRow; role: string; nameLen: number }[]> {
  const { data: companies } = await supabase
    .from("portfolio_companies")
    .select("id, company_name, domain, workspace_id")
    .eq("workspace_id", ws.workspace_id);

  if (!companies) return [];

  const matches: { company: CompanyRow; role: string; nameLen: number }[] = [];

  for (const company of companies) {
    const name = company.company_name;
    if (!name || name.length < 3) continue;
    // Exclure les noms de plateformes (LinkedIn, Google, etc.)
    if (BODY_MENTION_BLOCKLIST.has(name.toLowerCase())) continue;
    const rx = new RegExp(`\\b${escapeRegex(name.toLowerCase())}\\b`, "i");
    if (rx.test(fullText)) {
      matches.push({ company, role: ws.role, nameLen: name.length });
    }
  }

  return matches;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function found(data: CompanyRow, matchedBy: string): ResolvedCompany {
  return {
    found: true,
    companyId: data.id,
    companyName: data.company_name,
    workspaceId: data.workspace_id,
    domain: data.domain || null,
    matchedBy,
    profileId: null,
  };
}

function notFound(profileId: string | null): ResolvedCompany {
  return {
    found: false,
    companyId: null,
    companyName: null,
    workspaceId: null,
    domain: null,
    matchedBy: "none",
    profileId,
  };
}
