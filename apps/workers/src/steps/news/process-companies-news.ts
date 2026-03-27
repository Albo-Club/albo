/**
 * Step partagé : boucle sur une liste de companies, fetch news → score → store.
 * Utilisé par news-scraper (cron) et news-scraper-run (one-shot).
 */

import { logger, metadata } from "@trigger.dev/sdk";
import { fetchCompanyNews } from "./fetch-company-news.js";
import { scoreRelevance } from "./score-relevance.js";
import { storeNews } from "./store-news.js";

export interface CompanyToProcess {
  id: string;
  company_name: string;
  domain: string | null;
  workspace_id: string;
}

export interface ProcessResult {
  processed: number;
  totalNewsFound: number;
  totalInserted: number;
  totalCleaned: number;
  errors: number;
}

export async function processCompaniesNews(companies: CompanyToProcess[]): Promise<ProcessResult> {
  const total = companies.length;
  let totalNewsFound = 0;
  let totalInserted = 0;
  let totalCleaned = 0;
  let errors = 0;

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    if (!company.domain) continue;

    const progress = Math.round(((i + 1) / total) * 100);
    metadata.set("progress", progress);
    metadata.set("currentCompany", company.company_name);
    metadata.set("processedCompanies", i + 1);

    try {
      const fetchResult = await fetchCompanyNews({
        company_id: company.id,
        company_name: company.company_name,
        domain: company.domain,
        workspace_id: company.workspace_id,
      });

      logger.info(`[${i + 1}/${total}] ${company.company_name}: ${fetchResult.items.length} articles bruts`);

      if (fetchResult.items.length === 0) {
        await storeNews({ company_id: company.id, workspace_id: company.workspace_id, items: [] });
        continue;
      }

      const scored = await scoreRelevance(
        company.company_name,
        company.domain,
        fetchResult.resolution,
        fetchResult.items,
      );

      logger.info(`[${i + 1}/${total}] ${company.company_name}: ${scored.length}/${fetchResult.items.length} pertinents`);

      const storeResult = await storeNews({
        company_id: company.id,
        workspace_id: company.workspace_id,
        items: scored,
      });

      totalNewsFound += scored.length;
      totalInserted += storeResult.inserted;
      totalCleaned += storeResult.cleaned || 0;
    } catch (err: any) {
      errors++;
      logger.error(`[${i + 1}/${total}] ${company.company_name} échoué`, { error: err.message });
    }

    metadata.set("totalNewsFound", totalNewsFound);
    metadata.set("totalInserted", totalInserted);
    metadata.set("errors", errors);
  }

  return { processed: total, totalNewsFound, totalInserted, totalCleaned, errors };
}
