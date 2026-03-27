import { z } from 'zod';

// --- Company Analysis output schema ---

export const HealthScoreSchema = z.object({
  score: z.number().min(1).max(10).describe('Score de santé de 1 (critique) à 10 (excellent)'),
  label: z.enum(['Critique', 'Sous surveillance', 'En bonne voie', 'Excellent']),
  rationale: z.string().describe('Justification en 1-2 phrases'),
});

export const BpVsRealityItemSchema = z.object({
  metric: z.string().describe('Nom lisible de la métrique comparée'),
  deck_projection: z.string().describe('Ce que le deck promettait'),
  actual: z.string().describe('Ce qui s\'est réellement passé'),
  verdict: z.enum(['ahead', 'on_track', 'behind', 'no_data']),
  comment: z.string().describe('Commentaire court sur l\'écart'),
});

export const AlertSchema = z.object({
  severity: z.enum(['critical', 'warning', 'info']),
  message: z.string().describe('Description de l\'alerte'),
  metric_key: z.string().nullable().describe('Clé de métrique associée si applicable'),
});

export const RecommendedMetricSchema = z.object({
  key: z.string().describe('Clé de métrique existante dans la DB'),
  reason: z.string().describe('Pourquoi cette métrique est importante à suivre'),
  priority: z.number().describe('1 = plus important'),
});

export const CompanyAnalysisSchema = z.object({
  executive_summary: z.string().describe('3-4 phrases. État de la boîte, verdict BP vs réalité.'),

  health_score: HealthScoreSchema,

  bp_vs_reality: z.array(BpVsRealityItemSchema).describe(
    'Comparaison des projections du deck vs données réelles. Vide si pas de deck.'
  ),

  alerts: z.array(AlertSchema).describe('Signaux d\'alerte classés par sévérité'),

  recommended_metrics: z.array(RecommendedMetricSchema).describe(
    'Métriques les plus pertinentes à suivre, ordonnées par priorité'
  ),

  key_questions: z.array(z.string()).describe('Questions à poser à la boîte lors du prochain échange'),
});

export type CompanyAnalysis = z.infer<typeof CompanyAnalysisSchema>;
