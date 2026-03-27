/**
 * One-shot task pour lancer le news scraper sur un workspace spécifique.
 * Utilisé pour les tests manuels et les runs ciblés.
 */

import { task, logger, metadata } from "@trigger.dev/sdk";
import { supabase } from "../lib/supabase.js";
import { processCompaniesNews } from "../steps/news/process-companies-news.js";

interface NewsScraperPayload {
  workspace_id?: string;
  limit?: number;
}

export const newsScraperRunTask = task({
  id: "news-scraper-run",
  retry: { maxAttempts: 1 },
  run: async (payload: NewsScraperPayload) => {
    const { workspace_id, limit = 200 } = payload;

    logger.info("Démarrage news scraper run", { workspace_id, limit });
    metadata.set("status", "loading_companies");

    let query = supabase
      .from("portfolio_companies")
      .select("id, company_name, domain, workspace_id")
      .not("domain", "is", null)
      .limit(limit);

    if (workspace_id) {
      query = query.eq("workspace_id", workspace_id);
    }

    const { data: companies, error } = await query;
    if (error) throw new Error(`Chargement companies échoué: ${error.message}`);
    if (!companies || companies.length === 0) {
      logger.info("Aucune company à traiter");
      return { processed: 0, totalNews: 0 };
    }

    logger.info(`${companies.length} companies à traiter`);
    metadata.set("totalCompanies", companies.length);
    metadata.set("status", "processing");

    const result = await processCompaniesNews(companies);

    metadata.set("status", "completed");
    metadata.set("progress", 100);
    logger.info("News scraper run terminé", { ...result });
    return result;
  },
});
