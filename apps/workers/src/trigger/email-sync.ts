/**
 * Trigger.dev Task: Email Sync
 *
 * Job longue durée qui synchronise toute la boîte mail d'un user
 * via Unipile, matche les domaines contre son portfolio,
 * et upsert les matchs en DB.
 *
 * Concurrency: max 2 syncs simultanées (rate limit Unipile)
 * Retry: 3 tentatives avec backoff
 *
 * À la fin : écrit directement le statut dans connected_accounts
 * (remplace l'ancien callback vers edge function email-sync-complete)
 */

import { schemaTask, logger, metadata, tags } from "@trigger.dev/sdk";
import { z } from "zod";
import { loadDomains } from "../steps/email-sync/load-domains.js";
import { matchEmails } from "../steps/email-sync/match-emails.js";
import { storeMatches } from "../steps/email-sync/store-matches.js";
import { supabase } from "../lib/supabase.js";
import { processHistoricalReportsTask } from "./process-historical-reports.js";

const UNIPILE_DSN = (() => {
  const raw = (process.env.UNIPILE_DSN || "").trim();
  return raw.startsWith("http") ? raw : `https://${raw}`;
})();
const UNIPILE_API_KEY = (process.env.UNIPILE_API_KEY || "").trim();
const PAGE_SIZE = 250;

interface UnipilePage {
  items: Record<string, unknown>[];
  cursor?: string;
}

async function fetchEmailPage(
  accountId: string,
  cursor?: string,
  before?: string
): Promise<UnipilePage> {
  const params = new URLSearchParams({
    account_id: accountId,
    limit: String(PAGE_SIZE),
  });
  if (cursor) params.set("cursor", cursor);
  if (before) {
    // Unipile exige le format ISO 8601 strict : YYYY-MM-DDTHH:MM:SS.sssZ
    const d = new Date(before);
    if (!isNaN(d.getTime())) {
      params.set("before", d.toISOString());
    }
  }

  const url = `${UNIPILE_DSN}/api/v1/emails?${params}`;
  const res = await fetch(url, {
    headers: { "X-API-KEY": UNIPILE_API_KEY, accept: "application/json" },
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Unipile fetch failed: ${res.status} ${res.statusText} — ${errBody.slice(0, 300)}`);
  }

  return res.json() as Promise<UnipilePage>;
}

/**
 * Vérifie que le compte n'a pas été déconnecté pendant la sync.
 * Si déconnecté → on arrête silencieusement (pas d'erreur).
 */
async function isAccountStillActive(unipileAccountId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("status")
    .eq("provider_account_id", unipileAccountId)
    .single();

  // Pas de row = compte pas encore enregistré en DB → on continue la sync
  if (error || !data) return true;
  return data.status !== "disconnected";
}

/**
 * Met à jour le statut du compte directement en DB.
 * Remplace l'ancien callback vers email-sync-complete.
 */
async function updateAccountStatus(
  unipileAccountId: string,
  success: boolean
): Promise<void> {
  // Guard : ne pas remettre en active un compte déconnecté
  const stillActive = await isAccountStillActive(unipileAccountId);
  if (!stillActive) {
    logger.warn("Compte déconnecté pendant la sync — pas de mise à jour statut", {
      accountId: unipileAccountId,
    });
    return;
  }

  const { error } = await supabase
    .from("connected_accounts")
    .update({
      status: success ? "active" : "sync_error",
      last_synced_at: new Date().toISOString(),
    })
    .eq("provider_account_id", unipileAccountId);

  if (error) {
    logger.error("Erreur mise à jour connected_accounts", { error: error.message });
  }
}

export const emailSyncTask = schemaTask({
  id: "email-sync",
  schema: z.object({
    user_id: z.string().uuid(),
    unipile_account_id: z.string(),
    account_email: z.string().email().optional(),
    supabase_account_id: z.string().optional(),
    before: z.string().optional(),
    trigger_reason: z.string().optional(),
    added_domain: z.string().optional(),
  }),
  queue: {
    concurrencyLimit: 2,
  },
  retry: {
    maxAttempts: 3,
  },
  run: async (payload) => {
    const { user_id, unipile_account_id, trigger_reason, added_domain } = payload;

    // domain_added → full sync (ignorer before) pour scanner TOUS les emails
    const isFreshSync = trigger_reason === "domain_added";
    const before = isFreshSync ? undefined : payload.before;

    logger.info("Démarrage sync email", {
      userId: user_id,
      accountId: unipile_account_id,
      before: before || "full sync",
      triggerReason: trigger_reason || "manual",
      addedDomain: added_domain || "none",
      isFreshSync,
    });
    await tags.add(`user:${user_id}`);
    await tags.add(`account:${unipile_account_id}`);

    // Metadata pour suivi temps réel dans le dashboard
    metadata.set("status", "loading_domains");
    metadata.set("progress", 0);
    metadata.set("totalEmails", 0);
    metadata.set("totalMatches", 0);

    // Step 1: Charger les domaines du portfolio
    const domainsMap = await loadDomains(user_id);

    logger.info("Domaines chargés", { domainsCount: domainsMap.size });
    metadata.set("domainsCount", domainsMap.size);

    if (domainsMap.size === 0) {
      logger.warn("Aucun domaine trouvé pour ce user — rien à matcher");
      metadata.set("status", "completed_no_domains");
      await updateAccountStatus(unipile_account_id, true);
      return { totalMatches: 0, totalEmails: 0, pages: 0 };
    }

    // Step 2: Paginer les emails et matcher
    // Reprendre au dernier cursor en cas de retry (persisté dans metadata)
    const savedCursor = metadata.get("lastCursor") as string | undefined;
    const savedTotalMatches = (metadata.get("totalMatches") as number) || 0;
    const savedTotalEmails = (metadata.get("totalEmails") as number) || 0;
    const savedPageNum = (metadata.get("currentPage") as number) || 0;

    metadata.set("status", "syncing");
    let cursor: string | undefined = savedCursor || undefined;
    let totalMatches = savedTotalMatches;
    let totalEmails = savedTotalEmails;
    let pageNum = savedPageNum;

    if (savedCursor) {
      logger.info("Reprise après erreur", {
        cursor: savedCursor,
        fromPage: savedPageNum,
        totalEmailsSoFar: savedTotalEmails,
        totalMatchesSoFar: savedTotalMatches,
      });
    }

    try {
      while (true) {
        pageNum++;
        const page = await fetchEmailPage(unipile_account_id, cursor, before);
        totalEmails += page.items.length;

        // Matcher les emails de cette page
        const matches = matchEmails(
          page.items as any[],
          domainsMap,
          { userId: user_id, unipileAccountId: unipile_account_id }
        );

        // Stocker les matchs immédiatement (pas d'accumulation mémoire)
        if (matches.length > 0) {
          const result = await storeMatches(matches);
          totalMatches += result.matchesProcessed;

          // Log détaillé de chaque match pour visibilité dashboard
          for (const m of matches) {
            logger.info("Match trouvé", {
              subject: m.email_subject,
              company_id: m.company_id,
              domain: m.matched_domain,
              from: m.email_from?.identifier || "?",
              date: m.email_date,
            });
          }
        }

        // Log résumé page
        logger.info(`Page ${pageNum} traitée`, {
          emailsPage: page.items.length,
          matchesPage: matches.length,
          totalEmails,
          totalMatches,
        });

        // Metadata temps réel
        metadata.set("totalEmails", totalEmails);
        metadata.set("totalMatches", totalMatches);
        metadata.set("currentPage", pageNum);

        // Guard : vérifier que le compte n'a pas été déconnecté
        if (pageNum % 10 === 0) {
          const stillActive = await isAccountStillActive(unipile_account_id);
          if (!stillActive) {
            logger.warn("Compte déconnecté pendant la sync — arrêt");
            metadata.set("status", "aborted_disconnected");
            return { totalMatches, totalEmails, pages: pageNum, aborted: true };
          }
        }

        cursor = page.cursor;
        // Persister le cursor pour reprise en cas de retry
        if (cursor) metadata.set("lastCursor", cursor);
        if (!cursor || page.items.length === 0) break;
      }

      // Step 3: Écriture directe en DB
      metadata.set("status", "completed");
      metadata.set("progress", 100);

      logger.info("Sync terminée", { totalEmails, totalMatches, pages: pageNum });
      await updateAccountStatus(unipile_account_id, true);

      // Step 4: Lancer l'analyse des potential reports (si il y en a de non traités)
      const { count } = await supabase
        .from("email_company_matches")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user_id)
        .eq("is_potential_report", true)
        .is("report_processing_status", null);

      if (count && count > 0) {
        logger.info(`${count} potential reports non traités — lancement analyse historique`);
        await processHistoricalReportsTask.trigger({
          user_id,
          unipile_account_id,
          account_email: payload.account_email,
        });
      }

      return { totalMatches, totalEmails, pages: pageNum, pendingReports: count || 0 };
    } catch (err: any) {
      metadata.set("status", "error");
      metadata.set("error", err.message);

      logger.error("Sync échouée", { error: err.message, page: pageNum, totalEmails });
      await updateAccountStatus(unipile_account_id, false);
      throw err;
    }
  },
});
