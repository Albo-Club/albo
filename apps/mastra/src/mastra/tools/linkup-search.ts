import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { LinkupClient } from 'linkup-sdk';
import { ResearchCategorySchema } from '../schemas/investment-memo';

export const linkupSearchTool = createTool({
  id: 'linkup-search',
  description: 'Search the web using Linkup API for investment research on startups. Returns sourced answers with citations.',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    category: ResearchCategorySchema.describe('Research category for this search'),
    maxResults: z.number().default(5).describe('Maximum number of results'),
  }),
  outputSchema: z.object({
    category: ResearchCategorySchema,
    query: z.string(),
    summary: z.string(),
    sources: z.array(z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
    })),
  }),
  execute: async ({ query, category, maxResults }) => {
    const apiKey = process.env.LINKUP_API_KEY;
    if (!apiKey) {
      throw new Error('LINKUP_API_KEY environment variable is not set');
    }

    const client = new LinkupClient({ apiKey });

    const result = await client.search({
      query,
      depth: 'deep',
      outputType: 'searchResults',
      maxResults,
    });

    const searchResults = (result as any).results ?? [];

    const sources = searchResults.slice(0, maxResults).map((r: any) => ({
      title: r.name ?? r.title ?? 'Untitled',
      url: r.url ?? '',
      snippet: r.content?.slice(0, 500) ?? '',
    }));

    const summary = sources.length > 0
      ? sources.map((s: { title: string; snippet: string }) => `${s.title}: ${s.snippet}`).join('\n\n')
      : 'No results found for this query.';

    return {
      category,
      query,
      summary,
      sources,
    };
  },
});
