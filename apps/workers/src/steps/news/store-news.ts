/**
 * Upsert les news scorées dans company_news.
 * Dedup sur (company_id, source_url).
 * Cleanup des articles > 90 jours.
 */

import { supabase } from "../../lib/supabase";
import type { ScoredNewsItem } from "./score-relevance";

interface StoreInput {
  company_id: string;
  workspace_id: string;
  items: ScoredNewsItem[];
}

export async function storeNews(input: StoreInput): Promise<{ inserted: number; cleaned: number }> {
  const { company_id, workspace_id, items } = input;

  if (items.length === 0) {
    // Met à jour last_news_updated_at même si 0 résultat (évite re-fetch en boucle)
    await updateLastNewsTimestamp(company_id);
    return { inserted: 0, cleaned: 0 };
  }

  // 1. Upsert les news
  const rows = items.map(item => ({
    company_id,
    workspace_id,
    title: item.title,
    description: item.description,
    source_name: item.source_name,
    source_url: item.source_url,
    image_url: item.image_url,
    published_at: item.published_at,
    source_type: item.source_type,
    relevance_score: item.relevance_score,
    is_displayed: true,
    fetched_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("company_news")
    .upsert(rows, { onConflict: "company_id,source_url", count: "exact" });

  if (error) {
    console.error(`[store-news] Upsert failed for company ${company_id}:`, error.message);
  }

  // 2. Cleanup articles > 90 jours
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const { count: cleanedCount, error: cleanError } = await supabase
    .from("company_news")
    .delete({ count: "exact" })
    .eq("company_id", company_id)
    .lt("fetched_at", cutoff.toISOString());

  if (cleanError) {
    console.error(`[store-news] Cleanup failed for company ${company_id}:`, cleanError.message);
  }

  // 3. Met à jour le timestamp
  await updateLastNewsTimestamp(company_id);

  return {
    inserted: count ?? items.length,
    cleaned: cleanedCount ?? 0,
  };
}

async function updateLastNewsTimestamp(companyId: string): Promise<void> {
  const { error } = await supabase
    .from("portfolio_companies")
    .update({ last_news_updated_at: new Date().toISOString() })
    .eq("id", companyId);

  if (error) {
    console.error(`[store-news] Failed to update last_news_updated_at:`, error.message);
  }
}
