import { z } from 'zod';
import { createScorer } from '@mastra/core/evals';
import {
  getAssistantMessageFromRunOutput,
} from '@mastra/evals/scorers/utils';

// --- Memo Completeness Scorer (LLM-judged) ---

export const memoCompletenessScorer = createScorer({
  id: 'memo-completeness-scorer',
  name: 'Memo Completeness',
  description: 'Checks that the investment memo contains all required sections and substantive content',
  type: 'agent',
  judge: {
    model: 'anthropic/claude-sonnet-4-5',
    instructions:
      'You are an expert evaluator of investment memos. ' +
      'Check whether the memo contains all required sections with substantive content. ' +
      'Return only the structured JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const assistantText = getAssistantMessageFromRunOutput(run.output) || '';
    return { assistantText };
  })
  .analyze({
    description: 'Evaluate memo section completeness',
    outputSchema: z.object({
      sectionsFound: z.number().describe('Number of required sections found'),
      totalSections: z.number().describe('Total required sections (15)'),
      missingSections: z.array(z.string()),
      substantive: z.boolean().describe('Whether sections have real content vs placeholders'),
      explanation: z.string(),
    }),
    createPrompt: ({ results }) => `
      Evaluate the following investment memo for completeness.

      The memo should contain these 15 sections:
      1. En-tête (header with startup, sector, stage, date)
      2. Verdict & Synthèse
      3. Problème & Solution
      4. Marché Cible (with TAM/SAM/SOM)
      5. Modèle Économique
      6. Traction & Métriques
      7. Équipe
      8. Paysage Concurrentiel
      9. Analyse Financière
      10. Valorisation
      11. Impact ESG
      12. Risques Clés
      13. Catalyseurs
      14. Conditions d'Investissement
      15. Sources Citées

      Note: If this is a rejection memo, it only needs: startup, date, reasons, summary, and reconsideration milestones. In that case, give full marks if those are present.

      Memo to evaluate:
      """
      ${results.preprocessStepResult.assistantText}
      """

      Return JSON with: sectionsFound, totalSections, missingSections, substantive, explanation.
    `,
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    const ratio = (r.sectionsFound ?? 0) / (r.totalSections ?? 15);
    const substantiveBonus = r.substantive ? 0.1 : 0;
    return Math.min(1, ratio + substantiveBonus);
  })
  .generateReason(({ results, score }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return `Completeness: ${r.sectionsFound ?? 0}/${r.totalSections ?? 15} sections. Missing: ${(r.missingSections ?? []).join(', ') || 'none'}. Score=${score}. ${r.explanation ?? ''}`;
  });

// --- French Language Quality Scorer (LLM-judged) ---

export const frenchLanguageScorer = createScorer({
  id: 'french-language-scorer',
  name: 'French Language Quality',
  description: 'Checks that the memo is written in proper French with business terminology',
  type: 'agent',
  judge: {
    model: 'anthropic/claude-sonnet-4-5',
    instructions:
      'You are an expert evaluator of French business writing quality. ' +
      'Assess whether the text is written in proper French with correct grammar, ' +
      'appropriate business/finance terminology, and professional tone. ' +
      'Return only the structured JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const assistantText = getAssistantMessageFromRunOutput(run.output) || '';
    return { assistantText };
  })
  .analyze({
    description: 'Evaluate French language quality',
    outputSchema: z.object({
      isFrench: z.boolean(),
      grammarQuality: z.number().min(0).max(1),
      businessTerminology: z.number().min(0).max(1),
      professionalTone: z.number().min(0).max(1),
      explanation: z.string(),
    }),
    createPrompt: ({ results }) => `
      Evaluate the following text for French language quality in a business/investment context.

      Text:
      """
      ${results.preprocessStepResult.assistantText}
      """

      Assess:
      1. Is the text written in French? (isFrench: boolean)
      2. Grammar quality (0-1 scale)
      3. Appropriate use of business/finance terminology (0-1 scale)
      4. Professional tone appropriate for investment memos (0-1 scale)

      Return JSON with: isFrench, grammarQuality, businessTerminology, professionalTone, explanation.
    `,
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    if (!r.isFrench) return 0;
    return ((r.grammarQuality ?? 0) + (r.businessTerminology ?? 0) + (r.professionalTone ?? 0)) / 3;
  })
  .generateReason(({ results, score }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return `French quality: isFrench=${r.isFrench}, grammar=${r.grammarQuality}, terminology=${r.businessTerminology}, tone=${r.professionalTone}. Score=${score}. ${r.explanation ?? ''}`;
  });

// --- Word Count Scorer (code-based) ---

export const wordCountScorer = createScorer({
  id: 'word-count-scorer',
  name: 'Word Count',
  description: 'Checks that the memo falls within the 1,500-2,000 word target range',
  type: 'agent',
  judge: {
    model: 'anthropic/claude-sonnet-4-5',
    instructions: 'Count words and return results.',
  },
})
  .preprocess(({ run }) => {
    const assistantText = getAssistantMessageFromRunOutput(run.output) || '';
    const wordCount = assistantText.split(/\s+/).filter(w => w.length > 0).length;
    return { assistantText, wordCount };
  })
  .analyze({
    description: 'Assess word count compliance',
    outputSchema: z.object({
      wordCount: z.number(),
      inRange: z.boolean(),
      explanation: z.string(),
    }),
    createPrompt: ({ results }) => {
      const wc = results.preprocessStepResult.wordCount;
      return `The memo has ${wc} words. The target range is 1,500-2,000 words for a full memo, or 200-500 words for a rejection memo. Return JSON with wordCount (${wc}), inRange (boolean), and explanation. If the memo appears to be a rejection memo (short, mentions rejection/rejet), use the 200-500 range.`;
    },
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    if (r.inRange) return 1;
    const wc = r.wordCount ?? 0;
    // Soft penalty: lose points the further from range
    if (wc < 200) return 0.2;
    if (wc < 1500) return 0.5 + (wc - 200) / (1500 - 200) * 0.5;
    if (wc > 2000) return Math.max(0.3, 1 - (wc - 2000) / 2000);
    return 1;
  })
  .generateReason(({ results, score }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return `Word count: ${r.wordCount ?? 'unknown'}. In range: ${r.inRange}. Score=${score}. ${r.explanation ?? ''}`;
  });

// --- Source Attribution Scorer (LLM-judged) ---

export const sourceAttributionScorer = createScorer({
  id: 'source-attribution-scorer',
  name: 'Source Attribution',
  description: 'Checks that claims are properly sourced or flagged as unverified',
  type: 'agent',
  judge: {
    model: 'anthropic/claude-sonnet-4-5',
    instructions:
      'You are an expert evaluator of source attribution in investment analysis. ' +
      'Check whether factual claims are properly sourced or flagged as unverified. ' +
      'Return only the structured JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const assistantText = getAssistantMessageFromRunOutput(run.output) || '';
    return { assistantText };
  })
  .analyze({
    description: 'Evaluate source attribution quality',
    outputSchema: z.object({
      totalClaims: z.number(),
      sourcedClaims: z.number(),
      flaggedUnverified: z.number(),
      unsourcedUnflagged: z.number(),
      hasSourcesSection: z.boolean(),
      explanation: z.string(),
    }),
    createPrompt: ({ results }) => `
      Evaluate the following investment memo for source attribution quality.

      The memo should:
      - Cite sources for factual claims (market data, competitor info, financial figures)
      - Flag unverified claims with "[NON VÉRIFIÉ]" or similar markers
      - Have a "Sources Citées" section at the end
      - Flag contradictions with "[CONTRADICTION]"

      Memo:
      """
      ${results.preprocessStepResult.assistantText}
      """

      Count: total factual claims, sourced claims, flagged-as-unverified claims, and unsourced/unflagged claims.
      Return JSON with: totalClaims, sourcedClaims, flaggedUnverified, unsourcedUnflagged, hasSourcesSection, explanation.
    `,
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    const total = r.totalClaims ?? 1;
    const attributed = (r.sourcedClaims ?? 0) + (r.flaggedUnverified ?? 0);
    const ratio = attributed / Math.max(total, 1);
    const sourcesBonus = r.hasSourcesSection ? 0.1 : 0;
    return Math.min(1, ratio + sourcesBonus);
  })
  .generateReason(({ results, score }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return `Attribution: ${r.sourcedClaims ?? 0} sourced, ${r.flaggedUnverified ?? 0} flagged, ${r.unsourcedUnflagged ?? 0} unsourced. Sources section: ${r.hasSourcesSection}. Score=${score}. ${r.explanation ?? ''}`;
  });

export const investmentMemoScorers = {
  memoCompletenessScorer,
  frenchLanguageScorer,
  wordCountScorer,
  sourceAttributionScorer,
};
