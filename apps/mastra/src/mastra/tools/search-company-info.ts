import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { LinkupClient } from 'linkup-sdk';

function extractDomain(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim()
    .toLowerCase();
}

export const searchCompanyInfoTool = createTool({
  id: 'search-company-info',
  description: `Search the web using Linkup API to find a startup/company/fund website.
Returns multiple search result candidates (domain + snippet) from VC/startup ecosystem sources.
IMPORTANT: Prioritize results from Crunchbase, Dealroom, Pitchbook, Wellfound, or the company's own website.
The correct domain almost always contains the company name (e.g. "Mistral AI" → mistral.ai, "50 Partners" → 50partners.fr).
If no candidate domain contains the company name, return null.`,
  inputSchema: z.object({
    companyName: z.string().describe('Name of the company to search for'),
    country: z.string().optional().describe('Country of the company (optional, helps refine search)'),
  }),
  outputSchema: z.object({
    candidates: z.array(z.object({
      domain: z.string().describe('Domain extracted from the search result URL'),
      snippet: z.string().describe('Text snippet from the search result'),
    })).describe('Search result candidates — the agent must pick the right company domain from these'),
    found: z.boolean().describe('Whether any search results were found'),
  }),
  execute: async ({ companyName, country }) => {
    const apiKey = process.env.LINKUP_API_KEY;
    if (!apiKey) {
      throw new Error('LINKUP_API_KEY environment variable is not set');
    }

    try {
      const client = new LinkupClient({ apiKey });

      const result = await client.search({
        query: `"${companyName}" ${country || ''} startup site officiel crunchbase OR dealroom OR pitchbook`.trim(),
        depth: 'standard',
        outputType: 'searchResults',
        maxResults: 8,
      });

      const searchResults = (result as any).results ?? [];

      if (searchResults.length === 0) {
        return { candidates: [], found: false };
      }

      const candidates = searchResults
        .filter((r: any) => r.url)
        .map((r: any) => ({
          domain: extractDomain(r.url),
          snippet: (r.content ?? r.snippet ?? '').slice(0, 200),
        }));

      return { candidates, found: candidates.length > 0 };
    } catch {
      return { candidates: [], found: false };
    }
  },
});
