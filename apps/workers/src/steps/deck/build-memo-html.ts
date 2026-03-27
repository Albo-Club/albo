/**
 * Step: Build Memo HTML
 * Transforme le JSON DeckAnalysisResult en email HTML.
 * Templating déterministe — remplace le prompt Claude de 800 lignes.
 */

import type { DeckAnalysisResult } from "../../types/deck-analysis";

// --- i18n labels ---
interface MemoLabels {
  title: string;
  subtitle: string;
  preparedBy: string;
  en30sec: string;
  dealStructure: string;
  marketContext: string;
  marketSize: string;
  dynamics: string;
  positioning: string;
  businessFundamentals: string;
  metric: string;
  value: string;
  status: string;
  team: string;
  founderMarketFit: string;
  criticalGaps: string;
  totalHeadcount: string;
  tractionMetrics: string;
  performance: string;
  solutionValueProp: string;
  majorRisks: string;
  risk: string;
  mitigationRequired: string;
  investorsSyndication: string;
  lead: string;
  coInvestors: string;
  history: string;
  useOfFunds: string;
  acceptableTicket: string;
  participationConditions: string;
  footerTitle: string;
  confidential: string;
  analysisOn: string;
}

const LABELS_FR: MemoLabels = {
  title: "Mémo d'investissement",
  subtitle: "Préparé par: Albo",
  preparedBy: "Préparé par Albo",
  en30sec: "En 30 secondes",
  dealStructure: "Structure du deal",
  marketContext: "Marché & Contexte",
  marketSize: "Taille du marché",
  dynamics: "Dynamiques",
  positioning: "Positionnement",
  businessFundamentals: "Fondamentaux commerciaux",
  metric: "Métrique",
  value: "Valeur",
  status: "Statut",
  team: "Équipe",
  founderMarketFit: "Adéquation fondateur-marché",
  criticalGaps: "Lacunes critiques",
  totalHeadcount: "Effectif total",
  tractionMetrics: "Traction & Métriques clés",
  performance: "Performance",
  solutionValueProp: "Solution & Proposition de valeur",
  majorRisks: "Risques majeurs",
  risk: "RISQUE",
  mitigationRequired: "Atténuation requise",
  investorsSyndication: "Investisseurs & Syndication",
  lead: "Lead",
  coInvestors: "Co-investisseurs",
  history: "Historique",
  useOfFunds: "Utilisation des fonds",
  acceptableTicket: "Ticket acceptable",
  participationConditions: "Conditions de participation",
  footerTitle: "Analyse d'investissement Albo",
  confidential: "Confidentiel - Usage interne uniquement",
  analysisOn: "Analyse à retrouver sur",
};

const LABELS_EN: MemoLabels = {
  title: "Investment Memo",
  subtitle: "Prepared by: Albo",
  preparedBy: "Prepared by Albo",
  en30sec: "In 30 seconds",
  dealStructure: "Deal Structure",
  marketContext: "Market & Context",
  marketSize: "Market size",
  dynamics: "Dynamics",
  positioning: "Positioning",
  businessFundamentals: "Business Fundamentals",
  metric: "Metric",
  value: "Value",
  status: "Status",
  team: "Team",
  founderMarketFit: "Founder-market fit",
  criticalGaps: "Critical gaps",
  totalHeadcount: "Total headcount",
  tractionMetrics: "Traction & Key Metrics",
  performance: "Performance",
  solutionValueProp: "Solution & Value Proposition",
  majorRisks: "Major Risks",
  risk: "RISK",
  mitigationRequired: "Mitigation required",
  investorsSyndication: "Investors & Syndication",
  lead: "Lead",
  coInvestors: "Co-investors",
  history: "History",
  useOfFunds: "Use of funds",
  acceptableTicket: "Acceptable ticket",
  participationConditions: "Participation conditions",
  footerTitle: "Albo Investment Analysis",
  confidential: "Confidential - Internal use only",
  analysisOn: "Analysis available on",
};

function getLabels(lang: string): MemoLabels {
  return lang === "en" ? LABELS_EN : LABELS_FR;
}

export function buildMemoHtml(analysis: DeckAnalysisResult, language: string = "fr"): string {
  const L = getLabels(language);
  const locale = language === "en" ? "en-US" : "fr-FR";
  const date = new Date().toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(L.title)} - ${esc(analysis.company_name)}</title>
</head>
<body style="font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; background: #FFFFFF;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; color: #333333;">

${renderHeader(analysis, date, L)}
${renderEn30Secondes(analysis, L)}
${renderDealStructure(analysis, L)}
${renderMarketContext(analysis, L)}
${renderBusinessFundamentals(analysis, L)}
${renderTeam(analysis, L)}
${renderTractionMetrics(analysis, L)}
${renderSolutionValueProp(analysis, L)}
${renderRisks(analysis, L)}
${renderInvestorsSyndication(analysis, L)}
${renderRiskProfile(analysis, L)}
${renderFooter(date, L)}

    </div>
</body>
</html>`;
}

// --- Section renderers ---

function renderHeader(a: DeckAnalysisResult, date: string, L: MemoLabels): string {
  return `        <!-- EN-TÊTE -->
        <div style="border-bottom: 2px solid #1F77E0; padding-bottom: 20px; margin-bottom: 30px;">
            <h1 style="margin: 0 0 10px 0; font-size: 28px; font-weight: bold; color: #1F77E0;">${esc(a.company_name.toUpperCase())}</h1>
            <p style="margin: 0; font-size: 14px; color: #666666;"><strong>${esc(a.one_liner)}</strong></p>
            <p style="margin: 8px 0 0 0; font-size: 11px; color: #999999;">${esc(L.title)} | ${date} | ${esc(L.subtitle)}</p>
        </div>`;
}

function renderEn30Secondes(a: DeckAnalysisResult, L: MemoLabels): string {
  const badges = a.en_30_secondes.badges
    .map(
      (b) =>
        `                <span style="background: #E8F4F8; color: #1F77E0; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 500;">${esc(b)}</span>`
    )
    .join("\n");

  return `        <!-- EN 30 SECONDES -->
        <div style="background: #F8F8F8; border-left: 4px solid #1F77E0; padding: 15px; margin-bottom: 30px; border-radius: 3px;">
            <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #333333;">${esc(L.en30sec)}</h2>
            <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #555555;">
                ${esc(a.en_30_secondes.summary)}
            </p>
            <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
${badges}
            </div>
        </div>`;
}

function renderDealStructure(a: DeckAnalysisResult, L: MemoLabels): string {
  const rows = a.deal_structure.rows
    .map(
      (r, i) =>
        `                <tr${i % 2 === 1 ? ' style="background: #FFFFFF;"' : ""}>
                    <td style="padding: 8px; color: #666666;"><strong>${esc(r.label)}</strong></td>
                    <td style="padding: 8px; text-align: right; color: #333333;">${esc(r.value)}</td>
                </tr>`
    )
    .join("\n");

  return `        <!-- STRUCTURE DU DEAL -->
        <div style="background: #F9F9F9; padding: 15px; margin-bottom: 30px; border-radius: 3px; border: 1px solid #EEEEEE;">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: bold; color: #333333;">${esc(L.dealStructure)}</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
${rows}
            </table>
        </div>`;
}

function renderMarketContext(a: DeckAnalysisResult, L: MemoLabels): string {
  return `        <!-- MARCHÉ & CONTEXTE -->
        <div style="margin-bottom: 30px;">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: bold; color: #333333;">${esc(L.marketContext)}</h3>
            <p style="margin: 0 0 10px 0; font-size: 13px; line-height: 1.6; color: #555555;">
                <strong>${esc(L.marketSize)}</strong> : ${esc(a.market_context.market_size)}
            </p>
            <p style="margin: 0 0 10px 0; font-size: 13px; line-height: 1.6; color: #555555;">
                <strong>${esc(L.dynamics)}</strong> : ${esc(a.market_context.dynamics)}
            </p>
            <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #555555;">
                <strong>${esc(L.positioning)}</strong> : ${esc(a.market_context.positioning)}
            </p>
        </div>`;
}

function renderBusinessFundamentals(a: DeckAnalysisResult, L: MemoLabels): string {
  const rows = a.business_fundamentals
    .map(
      (f, i) =>
        `                    <tr${i % 2 === 1 ? ' style="background: #F9F9F9; border-bottom: 1px solid #EEEEEE;"' : ' style="border-bottom: 1px solid #EEEEEE;"'}>
                        <td style="padding: 8px; color: #555555;"><strong>${esc(f.metric)}</strong></td>
                        <td style="padding: 8px; text-align: center; color: #333333;">${esc(f.value)}</td>
                        <td style="padding: 8px; text-align: center; color: ${statusColor(f.status_color)};">${esc(f.status)}</td>
                    </tr>`
    )
    .join("\n");

  return `        <!-- FONDAMENTAUX COMMERCIAUX -->
        <div style="margin-bottom: 30px;">
            <h3 style="margin: 0 0 15px 0; font-size: 14px; font-weight: bold; color: #333333;">${esc(L.businessFundamentals)}</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #DDDDDD;">
                <thead>
                    <tr style="background: #F5F5F5; border-bottom: 1px solid #DDDDDD;">
                        <th style="padding: 10px; text-align: left; color: #333333; font-weight: bold;">${esc(L.metric)}</th>
                        <th style="padding: 10px; text-align: center; color: #333333; font-weight: bold;">${esc(L.value)}</th>
                        <th style="padding: 10px; text-align: center; color: #333333; font-weight: bold;">${esc(L.status)}</th>
                    </tr>
                </thead>
                <tbody>
${rows}
                </tbody>
            </table>
        </div>`;
}

function renderTeam(a: DeckAnalysisResult, L: MemoLabels): string {
  const members = a.team.members
    .map(
      (m) =>
        `                <li><strong>${esc(m.name)}</strong> (${esc(m.role)}) — ${esc(m.background)}</li>`
    )
    .join("\n");

  const gaps = a.team.gaps
    ? `\n            <p style="margin: 12px 0 0 0; font-size: 13px; color: #E74C3C;"><strong>${esc(L.criticalGaps)}</strong> : ${esc(a.team.gaps)}</p>`
    : "";

  const headcount = a.team.headcount
    ? `\n            <p style="margin: 12px 0 0 0; font-size: 13px; color: #555555;"><strong>${esc(L.totalHeadcount)}</strong> : ${esc(a.team.headcount)}.</p>`
    : "";

  return `        <!-- ÉQUIPE -->
        <div style="margin-bottom: 30px;">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: bold; color: #333333;">${esc(L.team)}</h3>
            <p style="margin: 0 0 10px 0; font-size: 13px; color: #555555;"><strong>${esc(L.founderMarketFit)} : ${esc(a.team.founder_market_fit)}</strong></p>
            <ul style="margin: 0; padding-left: 20px; font-size: 12px; line-height: 1.7; color: #555555;">
${members}
            </ul>${gaps}${headcount}
        </div>`;
}

function renderTractionMetrics(a: DeckAnalysisResult, L: MemoLabels): string {
  const rows = a.traction_metrics
    .map(
      (t, i) =>
        `                    <tr${i % 2 === 1 ? ' style="background: #F9F9F9; border-bottom: 1px solid #EEEEEE;"' : ' style="border-bottom: 1px solid #EEEEEE;"'}>
                        <td style="padding: 8px; color: #555555;">${esc(t.metric)}</td>
                        <td style="padding: 8px; text-align: center; color: #333333;"><strong>${esc(t.value)}</strong></td>
                        <td style="padding: 8px; text-align: center; color: ${statusColor(t.performance_color)};">${esc(t.performance)}</td>
                    </tr>`
    )
    .join("\n");

  return `        <!-- TRACTION & MÉTRIQUES -->
        <div style="margin-bottom: 30px;">
            <h3 style="margin: 0 0 15px 0; font-size: 14px; font-weight: bold; color: #333333;">${esc(L.tractionMetrics)}</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #DDDDDD;">
                <thead>
                    <tr style="background: #F5F5F5; border-bottom: 1px solid #DDDDDD;">
                        <th style="padding: 10px; text-align: left; color: #333333; font-weight: bold;">${esc(L.metric)}</th>
                        <th style="padding: 10px; text-align: center; color: #333333; font-weight: bold;">${esc(L.value)}</th>
                        <th style="padding: 10px; text-align: center; color: #333333; font-weight: bold;">${esc(L.performance)}</th>
                    </tr>
                </thead>
                <tbody>
${rows}
                </tbody>
            </table>
        </div>`;
}

function renderSolutionValueProp(a: DeckAnalysisResult, L: MemoLabels): string {
  const items = a.solution_value_prop
    .map(
      (s, i) =>
        `                <li${i < a.solution_value_prop.length - 1 ? ' style="margin-bottom: 8px;"' : ""}><strong>${esc(s.title)}</strong> : ${esc(s.description)}</li>`
    )
    .join("\n");

  return `        <!-- SOLUTION -->
        <div style="margin-bottom: 30px;">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: bold; color: #333333;">${esc(L.solutionValueProp)}</h3>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8; color: #555555;">
${items}
            </ul>
        </div>`;
}

function renderRisks(a: DeckAnalysisResult, L: MemoLabels): string {
  const cards = a.risks
    .map((r, i) => {
      const isLow = r.severity === "FAIBLE" || r.severity === "LOW";
      const bgColor = isLow ? "#FFF3CD" : "#FFEBEE";
      const borderColor = isLow ? "#F9A825" : "#E74C3C";
      const titleColor = isLow ? "#E65100" : "#C62828";
      const marginBottom = i < a.risks.length - 1 ? " margin-bottom: 12px;" : "";

      return `            <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 12px;${marginBottom} border-radius: 3px;">
                <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: bold; color: ${titleColor};">⚠️ ${esc(r.title)} (${esc(L.risk)} ${esc(r.severity)})</p>
                <p style="margin: 0 0 6px 0; font-size: 12px; color: #555555;">${esc(r.description)}</p>
                <p style="margin: 0; font-size: 11px; color: #666666;"><em>${esc(L.mitigationRequired)}</em> : ${esc(r.mitigation)}</p>
            </div>`;
    })
    .join("\n\n");

  return `        <!-- RISQUES MAJEURS -->
        <div style="margin-bottom: 30px;">
            <h3 style="margin: 0 0 15px 0; font-size: 14px; font-weight: bold; color: #333333;">${esc(L.majorRisks)}</h3>

${cards}
        </div>`;
}

function renderInvestorsSyndication(a: DeckAnalysisResult, L: MemoLabels): string {
  if (!a.investors_syndication) return "";

  const s = a.investors_syndication;
  const parts: string[] = [];

  if (s.lead) {
    parts.push(
      `            <p style="margin: 0 0 10px 0; font-size: 13px; color: #555555;"><strong>${esc(L.lead)}</strong> : ${esc(s.lead)}</p>`
    );
  }
  if (s.co_investors) {
    parts.push(
      `            <p style="margin: 0 0 10px 0; font-size: 13px; color: #555555;"><strong>${esc(L.coInvestors)}</strong> : ${esc(s.co_investors)}</p>`
    );
  }
  if (s.history) {
    parts.push(
      `            <p style="margin: 0 0 10px 0; font-size: 13px; color: #555555;"><strong>${esc(L.history)}</strong> : ${esc(s.history)}</p>`
    );
  }
  if (s.use_of_funds) {
    parts.push(
      `            <p style="margin: 0; font-size: 13px; color: #555555;"><strong>${esc(L.useOfFunds)}</strong> : ${esc(s.use_of_funds)}</p>`
    );
  }

  if (parts.length === 0) return "";

  return `        <!-- INVESTISSEURS & SYNDICATION -->
        <div style="background: #F0FFF4; border-left: 4px solid #27AE60; padding: 15px; margin-bottom: 30px; border-radius: 3px;">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: bold; color: #27AE60;">${esc(L.investorsSyndication)}</h3>
${parts.join("\n")}
        </div>`;
}

function renderRiskProfile(a: DeckAnalysisResult, L: MemoLabels): string {
  if (!a.risk_profile) return "";

  const conditionsPart = a.risk_profile.conditions
    ? `\n            <p style="margin: 0; font-size: 13px; color: #555555;">
                <strong>${esc(L.participationConditions)}</strong> : ${esc(a.risk_profile.conditions)}
            </p>`
    : "";

  return `        <!-- PROFIL DE RISQUE -->
        <div style="background: #F9F9F9; padding: 15px; margin-bottom: 30px; border-radius: 3px; border: 1px solid #EEEEEE;">
            <p style="margin: 0${a.risk_profile.conditions ? " 0 8px 0" : ""}; font-size: 13px; color: #555555;">
                <strong>${esc(L.acceptableTicket)}</strong> : ${esc(a.risk_profile.ticket_recommendation)}
            </p>${conditionsPart}
        </div>`;
}

function renderFooter(date: string, L: MemoLabels): string {
  return `        <!-- PIED DE PAGE -->
        <div style="border-top: 1px solid #DDDDDD; padding-top: 15px; margin-top: 30px; text-align: center; font-size: 11px; color: #999999;">
            <p style="margin: 5px 0;"><strong>${esc(L.footerTitle)}</strong></p>
            <p style="margin: 5px 0;">${esc(L.preparedBy)} | ${date}</p>
            <p style="margin: 5px 0; font-style: italic;">${esc(L.confidential)}</p>
            <p style="margin: 5px 0; font-style: italic;">
                ${esc(L.analysisOn)} <a href="https://app.alboteam.com" style="color: #1F77E0; text-decoration: underline;">app.alboteam.com</a>
            </p>
        </div>`;
}

// --- Utils ---

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusColor(color: "green" | "red" | "neutral"): string {
  if (color === "green") return "#27AE60";
  if (color === "red") return "#E74C3C";
  return "#999999";
}
