/**
 * Trigger.dev Scheduled Task: News Scraper
 *
 * Cron quotidien à 6h UTC (7h/8h Paris).
 * Rotation : 200 companies/jour (oldest `last_news_updated_at` first).
 * Pour chaque company : fetch (Serper news + LinkedIn) → score (Haiku) → store.
 *
 * Budget Serper : 2 req/company (news + LinkedIn) + 1 req domain resolve = 3 req
 * 200 × 3 = 600 req/jour → ~18K/mois (free tier = 2500, paid = 50K pour $50)
 */

import { schedules, logger, metadata } from "@trigger.dev/sdk";
import { supabase } from "../lib/supabase.js";
import { processCompaniesNews } from "../steps/news/process-companies-news.js";

const BATCH_SIZE = 200;

export const newsScraperTask = schedules.task({
  id: "news-scraper",
  cron: "0 6 * * *",
  run: async () => {
    logger.info("Démarrage news scraper");
    metadata.set("status", "loading_companies");
    metadata.set("progress", 0);

    const { data: companies, error } = await supabase
      .from("portfolio_companies")
      .select("id, company_name, domain, workspace_id")
      .not("domain", "is", null)
      .order("last_news_updated_at", { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE);

    if (error) throw new Error(`Chargement companies échoué: ${error.message}`);
    if (!companies || companies.length === 0) {
      logger.info("Aucune company à traiter");
      metadata.set("status", "completed_empty");
      return { processed: 0, totalNews: 0 };
    }

    logger.info(`${companies.length} companies à traiter`);
    metadata.set("totalCompanies", companies.length);
    metadata.set("status", "processing");

    const result = await processCompaniesNews(companies);

    metadata.set("status", "completed");
    metadata.set("progress", 100);
    logger.info("News scraper terminé", { ...result });
    return result;
  },
});
