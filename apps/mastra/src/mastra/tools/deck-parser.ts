import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { ParsedDeckSchema } from '../schemas/investment-memo';

export const deckParserTool = createTool({
  id: 'deck-parser',
  description: 'Parse a startup pitch deck from PDF (base64) or plain text and extract structured information.',
  inputSchema: z.object({
    startupName: z.string().describe('Name of the startup'),
    content: z.string().describe('Deck content: plain text or base64-encoded PDF'),
    format: z.enum(['text', 'pdf']).default('text'),
  }),
  outputSchema: ParsedDeckSchema,
  execute: async ({ startupName, content, format }) => {
    let textContent: string;

    if (format === 'pdf') {
      const { PDFParse } = await import('pdf-parse');
      const buffer = Buffer.from(content, 'base64');
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      textContent = result.text;
      await parser.destroy();
    } else {
      textContent = content;
    }

    // Split into sections for raw extraction
    const rawSections = textContent
      .split(/\n{2,}/)
      .map(s => s.trim())
      .filter(s => s.length > 10);

    // Extract fields using pattern matching on common deck structures
    const extract = (patterns: RegExp[], fallback: string = 'Non mentionné dans le deck'): string => {
      for (const pattern of patterns) {
        for (const section of rawSections) {
          const match = section.match(pattern);
          if (match) return section;
        }
      }
      return fallback;
    };

    return {
      startupName,
      problem: extract([/probl[eè]m/i, /pain\s*point/i, /challenge/i, /enjeu/i]),
      solution: extract([/solution/i, /product/i, /produit/i, /offre/i, /platform/i]),
      marketSize: extract([/march[ée]/i, /market\s*size/i, /TAM/i, /SAM/i, /SOM/i, /\$?\d+\s*(B|M|billion|million)/i]),
      businessModel: extract([/business\s*model/i, /mod[eè]le/i, /revenue/i, /pricing/i, /monétisation/i]),
      team: extract([/team/i, /[ée]quipe/i, /founder/i, /fondateur/i, /CEO/i, /CTO/i]),
      traction: extract([/traction/i, /metric/i, /growth/i, /MRR/i, /ARR/i, /user/i, /client/i]),
      financials: extract([/financ/i, /projection/i, /revenue/i, /burn\s*rate/i, /runway/i, /P&L/i]),
      fundraising: extract([/fundrais/i, /lever/i, /raising/i, /round/i, /seed/i, /series/i, /investissement/i]),
      competition: extract([/compet/i, /concurrent/i, /landscape/i, /alternative/i]),
      impact: extract([/impact/i, /ESG/i, /social/i, /environment/i, /ODD/i, /SDG/i, /durable/i]),
      rawSections,
    };
  },
});
