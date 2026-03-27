/**
 * Trigger.dev Task: Process Historical Reports
 *
 * Après une sync email, analyse les emails flaggés is_potential_report = true
 * via le pipeline report existant, puis envoie un email récap des reports extraits.
 *
 * Concurrency: 1 (ne pas surcharger Unipile)
 * Retry: 3 avec backoff
 */

import { task, logger, metadata } from "@trigger.dev/sdk";
import { supabase } from "../lib/supabase.js";
import { fetchEmailDetail } from "../lib/unipile.js";
import { runReportPipeline } from "../pipelines/report-pipeline.js";
import { classifyReport } from "../steps/email-sync/classify-report.js";
import {
  buildRecapEmailHtml,
  type ReportRecapItem,
} from "../steps/email-sync/build-recap-email.js";
import { sendEmail } from "../lib/unipile.js";
import { UNIPILE_ACCOUNT_ID } from "../lib/constants.js";

interface ProcessHistoricalPayload {
  user_id: string;
  unipile_account_id: string;
  account_email?: string;
}

interface PendingReport {
  id: string;
  unipile_email_id: string;
  email_subject: string;
  email_date: string | null;
  company_id: string;
  workspace_id: string;
  matched_domain: string;
  company_name: string | null;
}

export const processHistoricalReportsTask = task({
  id: "process-historical-reports",
  queue: {
    concurrencyLimit: 1,
  },
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: ProcessHistoricalPayload) => {
    const { user_id, unipile_account_id } = payload;
    const startTime = Date.now();

    logger.info("Démarrage analyse reports historiques", {
      userId: user_id,
      accountId: unipile_account_id,
    });

    metadata.set("status", "loading_pending");
    metadata.set("progress", 0);

    // Step 1: Charger les emails potential_report non encore traités
    const { data: pendingReports, error: fetchError } = await supabase
      .from("email_company_matches")
      .select("id, unipile_email_id, email_subject, email_date, company_id, workspace_id, matched_domain")
      .eq("user_id", user_id)
      .eq("is_potential_report", true)
      .is("report_processing_status", null)
      .order("email_date", { ascending: false });

    if (fetchError) {
      logger.error("Erreur chargement pending reports", { error: fetchError.message });
      throw new Error(`DB fetch failed: ${fetchError.message}`);
    }

    // Charger les noms de companies en batch
    const companyIds = [...new Set((pendingReports || []).map((r) => r.company_id))];
    const companyNameMap = new Map<string, string>();
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from("portfolio_companies")
        .select("id, company_name")
        .in("id", companyIds);
      for (const c of companies || []) {
        companyNameMap.set(c.id, c.company_name);
      }
    }

    const pending: PendingReport[] = (pendingReports || []).map((r) => ({
      ...r,
      company_name: companyNameMap.get(r.company_id) || null,
    }));

    if (pending.length === 0) {
      logger.info("Aucun report en attente de traitement");
      metadata.set("status", "completed_nothing");
      return { totalProcessed: 0, succeeded: 0, failed: 0, skipped: 0 };
    }

    // Dédupliquer par unipile_email_id (un même email peut matcher plusieurs companies)
    const seenEmailIds = new Set<string>();
    const uniquePending: PendingReport[] = [];
    for (const p of pending) {
      if (!seenEmailIds.has(p.unipile_email_id)) {
        seenEmailIds.add(p.unipile_email_id);
        uniquePending.push(p);
      }
    }

    logger.info(`${uniquePending.length} emails uniques à traiter (${pending.length} matchs total)`);
    metadata.set("status", "processing");
    metadata.set("totalReports", uniquePending.length);
    metadata.set("processedReports", 0);

    // Step 2: Traiter chaque email — ne collecter que les succès pour le récap
    const recapItems: ReportRecapItem[] = [];
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < uniquePending.length; i++) {
      const report = uniquePending[i];

      // Marquer en cours
      await supabase
        .from("email_company_matches")
        .update({ report_processing_status: "processing" })
        .eq("unipile_email_id", report.unipile_email_id)
        .eq("user_id", user_id);

      try {
        // Fetch le détail complet depuis Unipile
        const emailDetail = await fetchEmailDetail(report.unipile_email_id);

        if (!emailDetail) {
          logger.warn(`Email ${report.unipile_email_id} introuvable dans Unipile — skip`, {
            subject: report.email_subject,
          });
          await markProcessed(report.unipile_email_id, user_id, "skipped");
          skipped++;
          continue;
        }

        // Pré-filtre Haiku : vérifier que c'est un vrai report investisseur
        const classification = await classifyReport(
          emailDetail.subject || report.email_subject,
          emailDetail.from_attendee?.identifier || null,
          emailDetail.body || null,
          emailDetail.body_plain || null
        );

        if (!classification.isInvestorReport) {
          logger.info(`Email rejeté par Haiku: ${classification.contentType}`, {
            subject: report.email_subject,
            reason: classification.reason,
          });
          await markProcessed(report.unipile_email_id, user_id, "skipped");
          skipped++;
          continue;
        }

        // Lancer le pipeline report
        const result = await runReportPipeline(
          { ...emailDetail, email_id: report.unipile_email_id },
          {
            skipNotification: true,
            skipReportFilter: true,
            knownCompany: {
              companyId: report.company_id,
              companyName: report.company_name || report.matched_domain,
              workspaceId: report.workspace_id,
            },
          }
        );

        if (result.success) {
          await markProcessed(report.unipile_email_id, user_id, "processed");
          succeeded++;
          logger.info(`Report traité OK`, {
            subject: report.email_subject,
            company: result.companyName,
            period: result.reportPeriod,
          });

          // Ajouter au récap uniquement les succès
          recapItems.push({
            companyName: result.companyName || null,
            reportPeriod: result.reportPeriod || null,
            reportType: result.reportType || null,
            emailSubject: report.email_subject || "Sans sujet",
            emailDate: report.email_date,
            filesCount: result.filesCount || 0,
          });
        } else {
          await markProcessed(report.unipile_email_id, user_id, "failed");
          failed++;
          logger.warn(`Report échoué`, {
            subject: report.email_subject,
            error: result.error,
          });
        }
      } catch (err: any) {
        await markProcessed(report.unipile_email_id, user_id, "failed");
        failed++;
        logger.error(`Erreur traitement report`, {
          subject: report.email_subject,
          error: err.message,
        });
      }

      // Metadata temps réel
      metadata.set("processedReports", i + 1);
      metadata.set("succeeded", succeeded);
      metadata.set("failed", failed);
      metadata.set("progress", Math.round(((i + 1) / uniquePending.length) * 100));
    }

    // Step 3: Envoyer email récap (uniquement si des reports ont été extraits)
    const durationMs = Date.now() - startTime;
    const accountEmail = payload.account_email || "sync@alboteam.com";

    if (recapItems.length > 0) {
      const html = buildRecapEmailHtml(
        recapItems,
        { totalExtracted: recapItems.length, durationMs },
        accountEmail
      );

      // Récupérer l'email du user pour lui envoyer le récap
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user_id)
        .single();

      const recipientEmail = profile?.email || accountEmail;

      const sent = await sendEmail({
        accountId: UNIPILE_ACCOUNT_ID,
        to: [{ identifier: recipientEmail }],
        subject: `Albote | ${recapItems.length} reports extraits de votre boîte mail`,
        body: html,
      });

      if (sent) {
        logger.info("Email récap envoyé", { to: recipientEmail });
      } else {
        logger.error("Échec envoi email récap", { to: recipientEmail });
      }
    }

    metadata.set("status", "completed");
    metadata.set("progress", 100);

    const summary = { totalProcessed: uniquePending.length, succeeded, failed, skipped, durationMs };
    logger.info("Analyse historique terminée", summary);

    return summary;
  },
});

async function markProcessed(
  unipileEmailId: string,
  userId: string,
  status: "processed" | "failed" | "skipped"
): Promise<void> {
  await supabase
    .from("email_company_matches")
    .update({
      report_processing_status: status,
      report_processing_sent_at: status === "processed" ? new Date().toISOString() : null,
    })
    .eq("unipile_email_id", unipileEmailId)
    .eq("user_id", userId);
}
