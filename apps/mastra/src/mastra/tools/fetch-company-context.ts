import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const fetchCompanyContextTool = createTool({
  id: 'fetch-company-context',
  description: `Récupère tout le contexte d'une portfolio company depuis Supabase :
- Infos company (nom, secteurs, investissement, équipe)
- Pitch deck complet (texte extrait, si disponible)
- Documents uploadés (BP Excel, deck PDF) avec texte extrait et métriques
- Investor reports (headlines, highlights, métriques par report + texte OCR des PJ)
- Historique des métriques structurées (avec période, type et source : "report" ou "document_upload")
- Métadonnées (deck dispo, docs uploadés, nb reports, métriques graphables)`,

  inputSchema: z.object({
    company_id: z.string().describe('UUID de la portfolio company'),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    company_id: z.string(),
    company: z.any().describe('Infos company: name, domain, sectors, investment, team, etc.'),
    deck: z.any().describe('Pitch deck: available, full_text, chunks_count'),
    uploaded_documents: z.any().describe('Documents uploadés (BP, Excel, PDF): count, items avec name/mime_type/text_length, full_text extrait'),
    reports: z.any().describe('Investor reports: count, items avec headlines/highlights/metrics/raw_content/attached_files_text'),
    metrics: z.any().describe('Métriques historiques: history par key avec value/type/period/source ("report" ou "document_upload"). document_metrics_count = nb métriques issues du BP/deck'),
    _meta: z.any().describe('Métadonnées: has_deck, has_uploaded_docs, has_reports, has_metrics, has_document_metrics'),
  }),

  execute: async ({ company_id }) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/company-intelligence`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ company_id }),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Failed to fetch company context: ${response.status} ${body.slice(0, 200)}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(`Company intelligence API error: ${data.error || 'Unknown error'}`);
    }

    return data;
  },
});
