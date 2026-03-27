import { z } from 'zod';

// --- Workflow input ---

export const DeckInputSchema = z.object({
  startupName: z.string().describe('Name of the startup'),
  deckContent: z.string().describe('Deck content as plain text, or base64-encoded PDF'),
  deckFormat: z.enum(['text', 'pdf']).default('text').describe('Format of the deck content'),
  submitterName: z.string().optional().describe('Name of the person submitting the deck'),
});

export type DeckInput = z.infer<typeof DeckInputSchema>;

// --- Parsed deck ---

export const ParsedDeckSchema = z.object({
  startupName: z.string(),
  problem: z.string().describe('Problem addressed'),
  solution: z.string().describe('Proposed solution'),
  marketSize: z.string().describe('Market size claims (TAM/SAM/SOM)'),
  businessModel: z.string().describe('Revenue model and pricing'),
  team: z.string().describe('Founders and key team members'),
  traction: z.string().describe('Current traction and metrics'),
  financials: z.string().describe('Financial projections or current figures'),
  fundraising: z.string().describe('Amount raised / seeking'),
  competition: z.string().describe('Competitive landscape mentioned'),
  impact: z.string().describe('Social/environmental impact if mentioned'),
  rawSections: z.array(z.string()).describe('All extracted text sections'),
});

export type ParsedDeck = z.infer<typeof ParsedDeckSchema>;

// --- Web research ---

export const ResearchCategorySchema = z.enum([
  'market',
  'founders',
  'competition',
  'businessModel',
  'impact',
  'valuation',
  'traction',
  'regulatory',
]);

export type ResearchCategory = z.infer<typeof ResearchCategorySchema>;

export const WebResearchResultSchema = z.object({
  category: ResearchCategorySchema,
  query: z.string(),
  summary: z.string(),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string(),
    snippet: z.string(),
  })),
});

export type WebResearchResult = z.infer<typeof WebResearchResultSchema>;

export const WebResearchBatchSchema = z.object({
  results: z.array(WebResearchResultSchema),
});

// --- Rejection check ---

export const NoGoCriterionSchema = z.object({
  criterion: z.string(),
  triggered: z.boolean(),
  explanation: z.string(),
});

export const RejectionCheckSchema = z.object({
  rejected: z.boolean(),
  criteria: z.array(NoGoCriterionSchema),
  summary: z.string().describe('Brief summary of rejection decision'),
  reconsiderationMilestones: z.array(z.string()).optional().describe('Milestones for reconsideration if rejected'),
});

export type RejectionCheck = z.infer<typeof RejectionCheckSchema>;

// --- Validation ---

export const ValidationSchema = z.object({
  confirmedClaims: z.array(z.object({
    claim: z.string(),
    source: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
  })),
  contradictions: z.array(z.object({
    deckClaim: z.string(),
    researchFinding: z.string(),
    severity: z.enum(['critical', 'moderate', 'minor']),
  })),
  unverifiedClaims: z.array(z.string()),
  valuationAssessment: z.string(),
  overallReliability: z.enum(['high', 'medium', 'low']),
});

export type Validation = z.infer<typeof ValidationSchema>;

// --- Final investment memo ---

export const InvestmentMemoSchema = z.object({
  enTete: z.object({
    startup: z.string(),
    secteur: z.string(),
    stade: z.string(),
    dateAnalyse: z.string(),
    analyste: z.string().default('IA Investment Analyst'),
  }).describe('En-tête du mémo'),

  verdictSynthese: z.object({
    verdict: z.enum(['INVESTIR', 'REJETER', 'APPROFONDIR']),
    resume: z.string().describe('2-3 phrases maximum'),
  }).describe('Verdict et synthèse'),

  problemeEtSolution: z.object({
    probleme: z.string(),
    solution: z.string(),
    differenciationCle: z.string(),
  }),

  marcheCible: z.object({
    tam: z.string(),
    sam: z.string(),
    som: z.string(),
    dynamiqueCroissance: z.string(),
    sourcesVerifiees: z.array(z.string()),
  }),

  modeleEconomique: z.object({
    description: z.string(),
    unitEconomics: z.string(),
    scalabilite: z.string(),
  }),

  tractionEtMetriques: z.object({
    metriquesActuelles: z.string(),
    tendance: z.string(),
    comparaisonSecteur: z.string(),
  }),

  equipe: z.object({
    fondateurs: z.string(),
    complementarite: z.string(),
    expertise: z.string(),
    lacunes: z.string(),
  }),

  paysageCompetitif: z.object({
    concurrentsDirects: z.string(),
    concurrentsIndirects: z.string(),
    avantageConcurrentiel: z.string(),
    risqueDefensabilite: z.string(),
  }),

  analyseFinanciere: z.object({
    chiffresActuels: z.string(),
    projections: z.string(),
    coherence: z.string(),
    benchmarkSectoriel: z.string(),
  }),

  valorisation: z.object({
    valorisationDemandee: z.string(),
    multiplesComparables: z.string(),
    opinion: z.string(),
  }),

  impactEsg: z.object({
    impactSocial: z.string(),
    impactEnvironnemental: z.string(),
    alignementOdd: z.string(),
  }),

  risquesCles: z.array(z.object({
    risque: z.string(),
    severite: z.enum(['critique', 'modere', 'mineur']),
    mitigation: z.string(),
  })),

  catalyseurs: z.array(z.string()).describe('Facteurs positifs déclencheurs'),

  conditionsInvestissement: z.object({
    montantRecommande: z.string(),
    jalons: z.array(z.string()),
    conditionsSuspensives: z.array(z.string()),
  }),

  sourcesCitees: z.array(z.string()).describe('URLs and references used'),
});

export type InvestmentMemo = z.infer<typeof InvestmentMemoSchema>;

// --- Early rejection memo (shorter) ---

export const EarlyRejectionMemoSchema = z.object({
  startup: z.string(),
  dateAnalyse: z.string(),
  verdict: z.literal('REJETER'),
  raisonsPrincipales: z.array(z.string()),
  resume: z.string().describe('Paragraph explaining rejection in French'),
  jalonsReexamen: z.array(z.string()).describe('Milestones that would trigger reconsideration'),
});

export type EarlyRejectionMemo = z.infer<typeof EarlyRejectionMemoSchema>;

// --- Format validation result ---

export const FormatValidationSchema = z.object({
  wordCount: z.number(),
  wordCountValid: z.boolean(),
  allSectionsPresent: z.boolean(),
  missingSections: z.array(z.string()),
  verdictSet: z.boolean(),
  valid: z.boolean(),
});
