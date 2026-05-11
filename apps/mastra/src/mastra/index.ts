import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';
import { VercelDeployer } from '@mastra/deployer-vercel';
// ✅ Supprimé : toolCallAppropriatenessScorer, completenessScorer, translationScorer (weather-scorer)
import { portfolioEnricher } from './agents/portfolio-enricher';
import { companyIntelligenceAgent } from './agents/company-intelligence';
import { deckAnalyzer } from './agents/deck-analyzer';
import {
  memoCompletenessScorer,
  frenchLanguageScorer,
  wordCountScorer,
  sourceAttributionScorer,
} from './scorers/investment-memo-scorer';

export const mastra = new Mastra({
  server: {
    timeout: 10 * 60 * 1000,
  },
  deployer: new VercelDeployer({
    teamSlug: process.env.VERCEL_TEAM_SLUG!,
    projectName: process.env.VERCEL_PROJECT_NAME ?? 'albo-mastra',
    token: process.env.VERCEL_TOKEN!,
    maxDuration: 600,
    memory: 1024,
  }),
  // ✅ Supprimé : weatherWorkflow, investmentMemoWorkflow (fichiers supprimés)
  agents: { portfolioEnricher, companyIntelligenceAgent, deckAnalyzer },
  // ✅ Supprimé : toolCallAppropriatenessScorer, completenessScorer, translationScorer, weatherAgent
  scorers: {
    memoCompletenessScorer,
    frenchLanguageScorer,
    wordCountScorer,
    sourceAttributionScorer,
  },
  storage: new LibSQLStore({
    url: process.env.TURSO_DATABASE_URL ?? "file:./mastra.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new DefaultExporter(),
          new CloudExporter(),
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(),
        ],
      },
    },
  }),
});
