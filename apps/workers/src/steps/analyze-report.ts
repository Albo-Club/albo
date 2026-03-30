/**
 * Step: Analyze Report
 * Equivalent N8N: "Report Agent" + "Structured Output Parser"
 *
 * Uses Claude to extract structured data from report content.
 */

import { anthropic } from "../lib/anthropic";
import type { ResolvedCompany } from "./resolve-company";

export interface ReportAnalysis {
  companyId: string | null;
  companyName: string | null;
  workspaceId: string | null;
  companyNotFound: boolean;
  reportDate: string;
  reportTitle: string;
  reportPeriod: string;
  storagePeriod: string;
  reportType: "monthly" | "bimonthly" | "quarterly" | "semi-annual" | "annual";
  headline: string;
  keyHighlights: string[];
  metrics: Record<string, number>;
  /** "company_self" = report du fond/entreprise sur elle-même.
   *  "fund_portfolio_company" = un fond forward le reporting d'une de ses participations. */
  reportAbout: "company_self" | "fund_portfolio_company";
  /** Si reportAbout = "fund_portfolio_company", nom de la company concernée */
  targetCompanyName: string | null;
}

const SYSTEM_PROMPT = `RÔLE
Tu es un agent spécialisé dans l'analyse des investor updates (reports) envoyés par les startups du portefeuille d'un club de Business Angels.

CONTEXTE
Tu reçois en entrée :
- Le contenu d'un mail (thread email nettoyé)
- Optionnellement : le texte OCR d'un document PDF attaché
- Le company_id, company_name et workspace_id déjà résolus

Ton objectif : extraire les informations clés du report de manière structurée.

RÈGLES DE FORMATAGE

LANGUE
- Champs structurels (company_name, report_period, storage_period, report_type, report_date) → ANGLAIS obligatoire
- headline et key_highlights → langue du report original (souvent français)

REPORT_PERIOD
- En anglais, mois avec majuscule initiale
- Formats valides : "January 2026" | "November - December 2025" | "Q4 2025" | "2025"

STORAGE_PERIOD
- = report_period avec tous les espaces remplacés par des underscores _

REPORT_DATE
- Format ISO strict : YYYY-MM-DD (date d'envoi du mail, PAS la période couverte)

REPORT_TYPE
- Enum strict, minuscules : "monthly" | "bimonthly" | "quarterly" | "semi-annual" | "annual"

METRICS
- Extrais TOUTES les données chiffrées du report, sans exception. Chaque nombre pertinent doit devenir une métrique.
- Clés en snake_case strict, en anglais
- Valeurs = nombres uniquement
- Pourcentages en décimal : 5% → 0.05
- Nombres avec séparateurs de milliers : 6.366.894 ou 6,366,894 → 6366894
- Si une métrique est ABSENTE du report → NE PAS l'inclure

PÉRIODES MULTIPLES
- Si le report contient des données pour plusieurs périodes (actual vs budget, cumulé, mois différents), utilise des préfixes pour distinguer :
  - Données "actual" (réalisé) de la période principale : pas de préfixe → "revenue", "ebitda"
  - Données "budget" (prévisionnel) de la période principale : préfixe "budget_" → "budget_revenue", "budget_ebitda"
  - Données cumulées actual : préfixe "cumulative_" → "cumulative_revenue", "cumulative_ebitda"
  - Données cumulées budget : préfixe "cumulative_budget_" → "cumulative_budget_revenue"
  - Données d'une autre période (ex: budget mars dans un report février) : préfixe "forecast_[mois]_" → "forecast_march_revenue"
- Extrais CHAQUE ligne du P&L / compte de résultats, pas seulement les totaux.

NOMS DE MÉTRIQUES STANDARD (à utiliser quand applicable)
- revenue (cifra de negocios / chiffre d'affaires / importe neto)
- cogs (aprovisionamientos / coût des ventes)
- gross_margin (margen de explotación / marge brute)
- gross_margin_pct (% margen)
- staff_costs (gastos de personal / charges de personnel)
- other_opex (otros gastos de explotación / autres charges)
- ebitda
- ebitda_pct (% EBITDA)
- depreciation (amortización / amortissement)
- operating_result (resultado de explotación / résultat d'exploitation)
- financial_result (resultado financiero / résultat financier)
- pretax_result (resultado antes de impuestos / résultat avant impôts)
- net_result (resultado del ejercicio / résultat net)
- tax (impuesto sobre beneficios / impôts)
- Pour les métriques startup classiques : mrr, arr, gmv, cash_position, runway_months, burn_rate, customers, users, employees, churn_rate, conversion_rate, nps, aum

DÉTECTION FONDS / PARTICIPATION
- Si l'email est envoyé par un fonds d'investissement (VC, PE, family office, holding) ET que le contenu principal concerne une de ses participations (startup/entreprise spécifique), alors :
  - report_about = "fund_portfolio_company"
  - target_company_name = nom de la company concernée (pas le fond)
- Sinon : report_about = "company_self", target_company_name = null
- Indices : le sujet mentionne une entreprise différente du sender, le body parle d'une startup spécifique, le fond forward un reporting reçu d'une participation.

Tu dois répondre UNIQUEMENT avec un JSON valide, sans markdown, sans backticks.`;

export async function analyzeReport(
  textContent: string,
  ocrContent: string | null,
  company: ResolvedCompany,
  emailSubject: string,
  emailFrom: string,
  emailDate: string
): Promise<ReportAnalysis> {
  // Tronquer le contenu pour rester sous les limites de tokens
  const MAX_TEXT = 30000;
  const MAX_OCR = 30000;
  const truncText = textContent.length > MAX_TEXT
    ? textContent.slice(0, MAX_TEXT) + "\n[...tronqué]"
    : textContent;
  const truncOcr = ocrContent && ocrContent.length > MAX_OCR
    ? ocrContent.slice(0, MAX_OCR) + "\n[...tronqué]"
    : ocrContent;

  const userPrompt = `Analyse ce report d'investissement et produis le JSON structuré.

Company ID : ${company.companyId || ""}
Company name : ${company.companyName || ""}
Workspace ID : ${company.workspaceId || ""}

Sender email : ${emailFrom}
Email subject : ${emailSubject}
Email date : ${emailDate}

${truncOcr ? `--- OCR DU DOCUMENT ---\n${truncOcr}\n\n` : ""}--- CONTENU DU MAIL ---
${truncText}

Réponds avec un JSON contenant ces champs :
{
  "company_id": "UUID or null",
  "company_name": "string",
  "workspace_id": "UUID or null",
  "report_date": "YYYY-MM-DD",
  "report_title": "string",
  "report_period": "string",
  "storage_period": "string",
  "report_type": "monthly|bimonthly|quarterly|semi-annual|annual",
  "headline": "string",
  "key_highlights": ["string"],
  "metrics": { "key": number },
  "report_about": "company_self|fund_portfolio_company",
  "target_company_name": "string or null"
}`;

  // Retry avec backoff sur les 429 (rate limit Anthropic)
  const MAX_RETRIES = 3;
  let response: Awaited<ReturnType<typeof anthropic.messages.create>>;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });
      break;
    } catch (err: any) {
      const is429 = err?.status === 429 || String(err?.message || "").includes("429");
      if (is429 && attempt < MAX_RETRIES) {
        const waitSec = 30 * (attempt + 1); // 30s, 60s, 90s
        console.log(`[analyze-report] Rate limit 429, waiting ${waitSec}s before retry ${attempt + 1}/${MAX_RETRIES}`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        continue;
      }
      throw err;
    }
  }

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Parse JSON from response (handle potential markdown wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`[analyze-report] No JSON found in Claude response. Raw: ${text.slice(0, 300)}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (parseErr: any) {
    throw new Error(`[analyze-report] JSON parse failed: ${parseErr.message}. Raw: ${jsonMatch[0].slice(0, 300)}`);
  }

  return {
    companyId: parsed.company_id || company.companyId,
    companyName: parsed.company_name || company.companyName,
    workspaceId: parsed.workspace_id || company.workspaceId,
    companyNotFound: !parsed.company_id && !company.companyId,
    reportDate: parsed.report_date || emailDate.split("T")[0],
    reportTitle: parsed.report_title || emailSubject,
    reportPeriod: parsed.report_period || "",
    storagePeriod: parsed.storage_period || parsed.report_period?.replace(/\s/g, "_") || "",
    reportType: parsed.report_type || "monthly",
    headline: parsed.headline || "",
    keyHighlights: Array.isArray(parsed.key_highlights) ? parsed.key_highlights : [],
    metrics: parsed.metrics && typeof parsed.metrics === "object" ? parsed.metrics : {},
    reportAbout: parsed.report_about || "company_self",
    targetCompanyName: parsed.target_company_name || null,
  };
}
