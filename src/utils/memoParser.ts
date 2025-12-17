export interface ParsedMemo {
  title?: string;
  dealSource?: string;
  metrics?: Array<{ label: string; value: string; benchmark?: string }>;
  executiveSummary?: {
    what?: string;
    whyItWins?: string;
    proofPoints?: string[];
    risks?: string[];
    decision?: 'GO' | 'CONDITIONAL' | 'NO-GO';
    decisionText?: string;
  };
  terms?: {
    ticket?: string;
    preMoneyValuation?: string;
    useOfFunds?: string;
    milestones?: string[];
    exitScenarios?: string[];
  };
  problemSolution?: {
    problem?: string;
    solution?: string;
    keyPillars?: string[];
    valueProposition?: string;
  };
  marketAnalysis?: {
    tam?: string;
    sam?: string;
    som?: string;
    marketTrends?: string[];
    growthDrivers?: string[];
    marketDynamics?: string;
  };
  team?: {
    founders?: Array<{ name: string; role?: string; background?: string }>;
    keyHires?: string[];
    advisors?: string[];
    teamStrength?: string;
  };
  businessModel?: {
    revenueStreams?: string[];
    unitEconomics?: {
      cac?: string;
      ltv?: string;
      ltvCacRatio?: string;
    };
    pricingModel?: string;
    customerAcquisition?: string;
    scalability?: string;
  };
  competitive?: {
    competitors?: Array<{ name: string; positioning?: string }>;
    competitiveAdvantages?: string[];
    moat?: string;
    differentiation?: string;
  };
  traction?: {
    keyMetrics?: Array<{ metric: string; value: string; trend?: string }>;
    milestones?: string[];
    partnerships?: string[];
    customerTestimonials?: string[];
  };
  financials?: {
    revenue?: {
      current?: string;
      projected?: string;
      growth?: string;
    };
    burnRate?: string;
    runway?: string;
    profitability?: string;
    projections?: string[];
  };
  riskAnalysis?: {
    executionRisks?: string[];
    marketRisks?: string[];
    competitiveRisks?: string[];
    financialRisks?: string[];
    mitigationStrategies?: string[];
  };
  recommendation?: {
    decision?: 'GO' | 'CONDITIONAL' | 'NO-GO';
    ticket?: string;
    rationale?: string;
    conditions?: string[];
  };
  sections?: Array<{ title: string; content: string }>;
}

export function parseMemoMarkdown(markdown: string): ParsedMemo {
  const parsed: ParsedMemo = {
    sections: [],
  };

  if (!markdown) return parsed;

  const lines = markdown.split('\n');
  let currentSection: { title: string; content: string } | null = null;

  for (const line of lines) {
    // Parse title (H1)
    if (line.startsWith('# ')) {
      parsed.title = line.slice(2).trim();
      continue;
    }

    // Parse sections (H2)
    if (line.startsWith('## ')) {
      if (currentSection) {
        parsed.sections?.push(currentSection);
      }
      currentSection = { title: line.slice(3).trim(), content: '' };
      continue;
    }

    // Add content to current section
    if (currentSection) {
      currentSection.content += line + '\n';
    }
  }

  // Don't forget the last section
  if (currentSection) {
    parsed.sections?.push(currentSection);
  }

  // Parse specific sections
  for (const section of parsed.sections || []) {
    const titleLower = section.title.toLowerCase();

    if (titleLower.includes('executive summary') || titleLower.includes('synthèse')) {
      parsed.executiveSummary = parseExecutiveSummary(section.content);
    } else if (titleLower.includes('market') || titleLower.includes('marché')) {
      parsed.marketAnalysis = parseMarketAnalysis(section.content);
    } else if (titleLower.includes('team') || titleLower.includes('équipe')) {
      parsed.team = parseTeam(section.content);
    } else if (titleLower.includes('risk') || titleLower.includes('risque')) {
      parsed.riskAnalysis = parseRiskAnalysis(section.content);
    } else if (titleLower.includes('recommendation') || titleLower.includes('recommandation')) {
      parsed.recommendation = parseRecommendation(section.content);
    } else if (titleLower.includes('metric') || titleLower.includes('kpi')) {
      parsed.metrics = parseMetrics(section.content);
    }
  }

  return parsed;
}

function parseExecutiveSummary(content: string): ParsedMemo['executiveSummary'] {
  const result: ParsedMemo['executiveSummary'] = {};
  
  // Simple parsing - look for decision keywords
  if (content.toLowerCase().includes('go') && !content.toLowerCase().includes('no-go')) {
    result.decision = 'GO';
  } else if (content.toLowerCase().includes('no-go')) {
    result.decision = 'NO-GO';
  } else if (content.toLowerCase().includes('conditional')) {
    result.decision = 'CONDITIONAL';
  }

  result.decisionText = content.trim();
  return result;
}

function parseMarketAnalysis(content: string): ParsedMemo['marketAnalysis'] {
  const result: ParsedMemo['marketAnalysis'] = {};
  
  // Extract TAM/SAM/SOM if present
  const tamMatch = content.match(/TAM[:\s]+([^\n]+)/i);
  const samMatch = content.match(/SAM[:\s]+([^\n]+)/i);
  const somMatch = content.match(/SOM[:\s]+([^\n]+)/i);

  if (tamMatch) result.tam = tamMatch[1].trim();
  if (samMatch) result.sam = samMatch[1].trim();
  if (somMatch) result.som = somMatch[1].trim();

  return result;
}

function parseTeam(content: string): ParsedMemo['team'] {
  const result: ParsedMemo['team'] = {};
  result.teamStrength = content.trim();
  return result;
}

function parseRiskAnalysis(content: string): ParsedMemo['riskAnalysis'] {
  const result: ParsedMemo['riskAnalysis'] = {};
  
  // Extract bullet points as risks
  const bullets = content.match(/[-•]\s*([^\n]+)/g);
  if (bullets) {
    result.executionRisks = bullets.map(b => b.replace(/^[-•]\s*/, '').trim());
  }

  return result;
}

function parseRecommendation(content: string): ParsedMemo['recommendation'] {
  const result: ParsedMemo['recommendation'] = {};
  
  if (content.toLowerCase().includes('go') && !content.toLowerCase().includes('no-go')) {
    result.decision = 'GO';
  } else if (content.toLowerCase().includes('no-go')) {
    result.decision = 'NO-GO';
  } else if (content.toLowerCase().includes('conditional')) {
    result.decision = 'CONDITIONAL';
  }

  result.rationale = content.trim();
  return result;
}

function parseMetrics(content: string): ParsedMemo['metrics'] {
  const metrics: ParsedMemo['metrics'] = [];
  
  // Try to extract metrics from table or list format
  const lines = content.split('\n').filter(l => l.trim());
  for (const line of lines) {
    const parts = line.split(/[:|]/);
    if (parts.length >= 2) {
      metrics.push({
        label: parts[0].replace(/[-•*]/g, '').trim(),
        value: parts[1].trim(),
      });
    }
  }

  return metrics;
}
