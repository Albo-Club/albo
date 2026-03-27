/**
 * Step: Match Emails
 *
 * Pour un batch d'emails Unipile, extrait les domaines
 * de from/to/cc et les matche contre la domainsMap.
 * Retourne les objets prêts pour upsert via RPC.
 */

import type { DomainsMap } from "./load-domains.js";

interface Attendee {
  identifier?: string;
  display_name?: string;
}

interface UnipileEmailItem {
  id: string;
  subject?: string;
  date?: string;
  body?: string;
  body_plain?: string;
  thread_id?: string;
  provider_id?: string;
  has_attachments?: boolean;
  from_attendee?: Attendee;
  to_attendees?: Attendee[];
  cc_attendees?: Attendee[];
  [key: string]: unknown;
}

export interface EmailMatch {
  user_id: string;
  company_id: string;
  workspace_id: string;
  unipile_email_id: string;
  unipile_account_id: string;
  email_date: string | null;
  email_subject: string | null;
  email_from: { identifier?: string; display_name?: string };
  email_to: Attendee[];
  has_attachments: boolean;
  matched_domain: string;
  cc_attendees: Attendee[];
  provider_id: string | null;
  is_potential_report: boolean;
  detail_fetched_at: string;
  thread_id: string | null;
  body_html: string | null;
  body_plain: string | null;
  snippet: string | null;
}

interface MatchContext {
  userId: string;
  unipileAccountId: string;
}

// ── Scoring « is_potential_report » ─────────────────────────────
// Entraîné sur 103 emails envoyés manuellement à report@alboteam.com (ground truth)
//
// Patterns observés dans les vrais reports :
//   - "Reporting Klara - January 2026"       → reporting + mois
//   - "Rapport d'activité Agilitest"          → rapport
//   - "Investor Update - February"            → investor update
//   - "Timeleft Financials 01.2026"           → financials
//   - "Point Mensuel Dropcontact"             → point mensuel
//   - "Newsletter Billiv - janvier 2026"      → newsletter
//   - "Note Actionnaire 1er trimestre 2026"   → note actionnaire
//
// Faux positifs fréquents à exclure :
//   - "Guest Shift update"                    → update opérationnel
//   - "Bon de commande Yokitup"               → transactionnel
//   - "EURAZEO INVESTOR DAY"                  → invitation événement

// Keywords forts : quasi-certains d'être un report
const STRONG_KEYWORDS = /\b(reportings?|reports?|rapports?|bilans?|compta(?:ble)?|financials?)\b/i;

// Keywords moyens : souvent un report si pas dans un contexte négatif
// Gère pluriels (investors/updates) et apostrophes (shareholders')
const MEDIUM_KEYWORDS = /\b(investors?\s+updates?|updates?\s+(?:investisseurs?|mensuel)|shareholders?'?\s+(?:updates?|newsletters?|letters?)|note\s+actionnaires?|point\s+mensuel|quarterly\s+reports?)\b/i;

// Keywords faibles — testés individuellement pour compter les signaux distincts
// Deux weak keywords distincts dans un même sujet = score +2 (au lieu de +1)
const WEAK_KEYWORD_LIST: RegExp[] = [
  /\bupdate\b/i,
  /\bnewsle?t+ers?\b/i,        // tolère "Newslettter" (typo fréquente : t+ = 1+ t)
  /\bnews\b/i,
  /\bnouvelles\b/i,
  /\bperformances?\b/i,
  /\bforecasts?\b/i,
  /\bpr[eé]visions?\b/i,
  /\btr[eé]sorerie\b/i,
  /\binventaire\b/i,
  /\bkpi\b/i,
  /\bm[eé]mo\b/i,
  /\bpoint\s+de\s+situation\b/i,
  /\bdonn[eé]es\s+de\s+ventes?\b/i,
  /\bissue\s+#?\d+\b/i,        // "Issue 9", "Issue #79" (newsletter numérotée)
];

// Patterns temporels : renforcent la probabilité (mois, trimestre, année)
// Pas de \b finale pour que les préfixes matchent ("janvier", "février", etc.)
// Dates supportées : dd-mm-yyyy, dd/mm/yy, mm.yy, Q1, FY2025, trimestre, mois en texte
// Pas de \b finale sur les préfixes de mois (janv→janvier, févr→février)
const TEMPORAL_PATTERN = /(?:\b(?:janv|f[eé]vr|mars|avri|mai|juin|juil|ao[uû]t|sept|octo|nove|d[eé]ce|january|february|march|april|june|july|august|september|october|november|december)|\b(?:Q[1-4]|FY\s?\d{4}|trimestre)\b|\d{2}[-./]\d{2}(?:[-./]\d{2,4})?)/i;

// Filtres négatifs : contexte qui disqualifie
const NEGATIVE_KEYWORDS = /\b(invitation|kick-?off?|meeting|reminder|rsvp|confirmation|bon\s+de\s+commande|receipt|reçu|facture|devis|annulé|cancelled|calendar|privatisation|team\s+meeting|mgmt\s+meeting)\b/i;

// Senders automatiques (no-reply, notifications) = probablement pas un report
const AUTO_SENDER_PATTERN = /^(no-?reply|notifications?|calendar|events|noreply|mailer-daemon)/i;

// ── Body scoring ─────────────────────────────────────────────────
// Analyse le corps de l'email quand le sujet seul est insuffisant.
// Entraîné sur les bodies des 103 vrais reports de report@alboteam.com.
//
// Patterns body observés dans les vrais reports :
//   - "backmarket"    → "Reporting - Janvier 2026", "EBITDA positif", "1,5 M€"
//   - "wandercraft"   → "Reporting - S2 2025", "chiffre d'affaires de 7,1M€"
//   - "Genomines"     → "Reporting – Décembre 2025", "Résumé exécutif"
//   - "Act running"   → "87K€ de CA", "record", "+24% sur l'objectif"
//   - "veevart"       → "Report powered by eClub", "Reporting Q4.25"

/** Strip HTML → plain text (pas besoin d'un parser complet) */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Indicateurs financiers dans le body (très forte probabilité de report)
// Retiré \bCA\b (trop générique — California, Canada, "ça"), gardé "chiffre d'affaires" explicite
// Retiré \brevenu\b (trop courant seul), gardé "revenue" (anglais, plus spécifique en contexte FR)
const BODY_FINANCIAL = /(?:\d+[.,]?\d*\s*[kKmM]€|\d+[.,]?\d*\s*M€|€\s*\d{2,}|\$\s*\d{2,}|\b(?:MRR|ARR|EBITDA|GMV|NRR|burn\s*rate|runway|chiffre\s+d['']affaires|revenue|marge\s+(?:brute|nette|op[eé]rationnelle)|cash\s*flow)\b)/i;

// Patterns de croissance (spécifiques aux reports, pas les mots business génériques)
// Retiré : objectif, target, budget (trop courants), pourcentages nus (partout dans les emails pro)
// Gardé : croissance/growth/traction/forecast/prévision + pourcentages avec contexte financier
const BODY_METRICS = /(?:\b(?:croissance|growth|traction|forecast|pr[eé]vision)\b|(?:CA|MRR|ARR|marge|revenue)\s*[:=]?\s*[+-]?\d+[.,]?\d*\s*%)/i;

// Mots-clés de structure de report (inchangé — très spécifiques)
const BODY_REPORT_STRUCTURE = /\b(r[eé]sum[eé]\s+ex[eé]cutif|key\s+highlights?|investor\s+update|reporting|rapport\s+d['']activit[eé]|rapport\s+de\s+gestion|shareholders?\s+(?:update|letter)|TL;?DR)\b/i;

// Patterns d'intro investisseur (retiré "bonjour à tous" et "hello everyone" — trop génériques)
const BODY_INVESTOR_INTRO = /\b(chers?\s+investisseurs?|dear\s+investors?|chers?\s+actionnaires?|dear\s+shareholders?)\b/i;

/** Max de body analysé (premiers 2000 chars suffisent) */
const BODY_ANALYSIS_LIMIT = 2000;

/**
 * Score le body d'un email pour détecter un report.
 * Seulement appelé quand le sujet seul est insuffisant (score < seuil).
 * Retourne 0 à 4 points.
 */
function scoreBodyContent(bodyHtml: string | null, bodyPlain: string | null): number {
  // Préférer body_plain si disponible, sinon stripper le HTML
  let text = bodyPlain || "";
  if (!text && bodyHtml) {
    text = stripHtml(bodyHtml);
  }
  if (!text) return 0;

  // Limiter l'analyse aux premiers 2000 chars (performance)
  text = text.substring(0, BODY_ANALYSIS_LIMIT);

  let score = 0;

  // Indicateurs financiers (+2) — signal le plus fort
  if (BODY_FINANCIAL.test(text)) score += 2;

  // Structure de report (+2) — "Résumé exécutif", "Key highlights", etc.
  if (BODY_REPORT_STRUCTURE.test(text)) score += 2;

  // Métriques/pourcentages (+1) — renforce le signal
  if (BODY_METRICS.test(text)) score += 1;

  // Intro investisseur (+1) — "Chers investisseurs", "Dear investors"
  if (BODY_INVESTOR_INTRO.test(text)) score += 1;

  // Cap à 3 pour le body (ne doit pas dominer le scoring)
  return Math.min(score, 3);
}

/**
 * Score un email pour déterminer s'il est un potential report.
 * Seuil ≥ 2 = flaggé.
 *
 * Couche 1 : sujet (rapide, couvre 82% des cas)
 * Couche 2 : body (appelé seulement si sujet insuffisant, couvre le reste)
 *
 * Entraîné sur 103 vrais reports (report@alboteam.com ground truth)
 * et 80+ non-reports du batch Baptiste.
 */
function scoreReportLikelihood(
  subject: string | null,
  fromEmail: string | null,
  bodyHtml: string | null,
  bodyPlain: string | null
): number {
  let score = 0;

  // ── Couche 1 : Sujet ──
  if (subject) {
    const cleaned = subject.replace(/^(Re:\s*|RE:\s*|FW:\s*|Fwd:\s*|TR:\s*)+/i, "").trim();

    if (STRONG_KEYWORDS.test(cleaned)) score += 3;
    if (MEDIUM_KEYWORDS.test(cleaned)) score += 3;

    const weakHits = WEAK_KEYWORD_LIST.filter((re) => re.test(cleaned)).length;
    score += Math.min(weakHits, 2);

    if (TEMPORAL_PATTERN.test(cleaned)) score += 1;
    if (NEGATIVE_KEYWORDS.test(cleaned)) score -= 3;

    if (fromEmail && AUTO_SENDER_PATTERN.test(fromEmail.split("@")[0])) score -= 2;
    if (/^(Re:|RE:)/i.test(subject)) score -= 1;
  }

  // ── Couche 2 : Body (seulement si sujet insuffisant) ──
  if (score < REPORT_SCORE_THRESHOLD) {
    score += scoreBodyContent(bodyHtml, bodyPlain);
  }

  return score;
}

const REPORT_SCORE_THRESHOLD = 2;

function extractDomain(email: string | undefined): string | null {
  if (!email) return null;
  const parts = email.split("@");
  return parts.length === 2 ? parts[1].toLowerCase() : null;
}

function collectDomains(email: UnipileEmailItem): string[] {
  const domains = new Set<string>();

  const fromDomain = extractDomain(email.from_attendee?.identifier);
  if (fromDomain) domains.add(fromDomain);

  for (const att of email.to_attendees || []) {
    const d = extractDomain(att.identifier);
    if (d) domains.add(d);
  }

  for (const att of email.cc_attendees || []) {
    const d = extractDomain(att.identifier);
    if (d) domains.add(d);
  }

  return Array.from(domains);
}

export function matchEmails(
  emails: UnipileEmailItem[],
  domainsMap: DomainsMap,
  ctx: MatchContext
): EmailMatch[] {
  const matches: EmailMatch[] = [];
  const now = new Date().toISOString();

  for (const email of emails) {
    const emailDomains = collectDomains(email);

    // Pour chaque domaine trouvé dans l'email, chercher des matchs
    const matchedCompanyIds = new Set<string>();

    for (const domain of emailDomains) {
      const companyMatches = domainsMap.get(domain);
      if (!companyMatches) continue;

      for (const cm of companyMatches) {
        // Éviter les doublons si un email matche la même company via from ET to
        const key = cm.company_id;
        if (matchedCompanyIds.has(key)) continue;
        matchedCompanyIds.add(key);

        // Snippet : premiers 200 chars du body plain
        const bodyPlain = email.body_plain || null;
        const snippet = bodyPlain ? bodyPlain.substring(0, 200) : null;

        matches.push({
          user_id: ctx.userId,
          company_id: cm.company_id,
          workspace_id: cm.workspace_id,
          unipile_email_id: email.id,
          unipile_account_id: ctx.unipileAccountId,
          email_date: email.date || null,
          email_subject: email.subject || null,
          email_from: email.from_attendee || {},
          email_to: email.to_attendees || [],
          has_attachments: email.has_attachments || false,
          matched_domain: domain,
          cc_attendees: email.cc_attendees || [],
          provider_id: email.provider_id || null,
          is_potential_report: scoreReportLikelihood(
            email.subject || null,
            email.from_attendee?.identifier || null,
            email.body || null,
            email.body_plain || null
          ) >= REPORT_SCORE_THRESHOLD,
          detail_fetched_at: now,
          thread_id: email.thread_id || null,
          body_html: email.body || null,
          body_plain: bodyPlain,
          snippet,
        });
      }
    }
  }

  return matches;
}
