import "dotenv/config";
import express from "express";
import multer from "multer";
import { runReportPipeline } from "./pipelines/report-pipeline";
import { runDeckPipeline } from "./pipelines/deck-inbox";
import { runDeckFrontendPipeline } from "./pipelines/deck-frontend";
import { tasks } from "@trigger.dev/sdk";
import type { emailSyncTask } from "./trigger/email-sync";
import { fetchEmailDetail, listEmails, sendEmail } from "./lib/unipile";
import { buildRecapEmailHtml, type ReportRecapItem } from "./steps/email-sync/build-recap-email";
import { supabase } from "./lib/supabase";

// Multer : stockage mémoire pour recevoir le PDF du frontend
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: "50mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Report processing webhook
// Called by email-router-webhook (Supabase Edge Function)
app.post("/webhook/report", async (req, res) => {
  const startTime = Date.now();
  console.log(`[server] POST /webhook/report received`);

  // Respond immediately to avoid timeout on the caller side
  res.json({ received: true, processing: true });

  // Process in background
  try {
    const result = await runReportPipeline(req.body);
    console.log(`[server] Pipeline result:`, {
      success: result.success,
      reportId: result.reportId,
      duration: `${result.durationMs}ms`,
    });
  } catch (error: any) {
    console.error(`[server] Pipeline error:`, error.message);
  }
});

// Test endpoint: pass { email_id, account_id } to fetch from Unipile and run pipeline
app.post("/test/report", async (req, res) => {
  try {
    let payload = req.body;

    // If only email_id provided, fetch full email from Unipile first
    if (payload.email_id && !payload.from_attendee) {
      const emailId = payload.email_id;
      console.log(`[server] Fetching email ${emailId} from Unipile...`);
      const email = await fetchEmailDetail(emailId);
      if (!email) {
        res.status(404).json({ error: `Email ${emailId} not found in Unipile` });
        return;
      }
      payload = { ...email, email_id: emailId };
    }

    const result = await runReportPipeline(payload);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Batch process N latest emails from report@ inbox
app.post("/test/batch-reports", async (req, res) => {
  const accountId = req.body.account_id || "_6sjZD6zSUmIEb1N8gqAow";
  const limit = req.body.limit || 4;

  const offset = req.body.offset || 0;
  const fetchLimit = offset + limit;
  console.log(`[server] Fetching emails ${offset}-${offset + limit} for account ${accountId}...`);
  const allEmails = await listEmails(accountId, fetchLimit);
  const emails = allEmails.slice(offset, offset + limit);

  if (emails.length === 0) {
    res.status(404).json({ error: "No emails found" });
    return;
  }

  const skipNotification = req.body.skip_notification ?? false;
  console.log(`[server] Found ${emails.length} emails, processing sequentially (skipNotification=${skipNotification})...`);
  const results: Array<{ emailId: string; subject: string; result: unknown }> = [];

  for (const email of emails) {
    console.log(`[server] Processing: "${email.subject}" (${email.id})`);
    try {
      const result = await runReportPipeline({ ...email, email_id: email.id }, { skipNotification });
      results.push({ emailId: email.id, subject: email.subject, result });
    } catch (error: any) {
      results.push({ emailId: email.id, subject: email.subject, result: { success: false, error: error.message } });
    }
  }

  res.json({ processed: results.length, results });
});

// Deck processing webhook
// Called by email-router-webhook (Supabase Edge Function) for deck@alboteam.com
app.post("/webhook/deck", async (req, res) => {
  console.log(`[server] POST /webhook/deck received`);

  // Respond immediately to avoid timeout
  res.json({ received: true, processing: true });

  // Process in background
  try {
    const result = await runDeckPipeline(req.body);
    console.log(`[server] Deck pipeline result:`, {
      success: result.success,
      dealId: result.dealId,
      companyName: result.companyName,
      duration: `${result.durationMs}ms`,
    });
  } catch (error: any) {
    console.error(`[server] Deck pipeline error:`, error.message);
  }
});

// Test endpoint for deck pipeline
app.post("/test/deck", async (req, res) => {
  try {
    let payload = req.body;

    // If only email_id provided, fetch full email from Unipile first
    if (payload.email_id && !payload.from_attendee) {
      const emailId = payload.email_id;
      console.log(`[server] Fetching email ${emailId} from Unipile...`);
      const email = await fetchEmailDetail(emailId);
      if (!email) {
        res.status(404).json({ error: `Email ${emailId} not found in Unipile` });
        return;
      }
      payload = { ...email, email_id: emailId };
    }

    const result = await runDeckPipeline(payload);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Deck analysis from frontend (replaces N8N "Analyze deck via front-end")
// Called by SubmitDeal.tsx — receives FormData with files (PDF, Excel, Word, Images) + metadata
// Supporte "file" (single, rétrocompat) et "files" (multi) comme clés FormData
app.post("/webhook/analyze-deck", upload.any(), async (req, res) => {
  console.log(`[server] POST /webhook/analyze-deck received`);

  const uploadedFiles = req.files as Express.Multer.File[] | undefined;
  const { deal_id, analysis_id, additional_context, user_email } = req.body;

  if (!uploadedFiles?.length || !deal_id || !analysis_id || !user_email) {
    res.status(400).json({
      error: "Champs requis: file(s) (PDF/Excel/Word/Image), deal_id, analysis_id, user_email",
    });
    return;
  }

  console.log(`[server] ${uploadedFiles.length} fichier(s): ${uploadedFiles.map((f) => f.originalname).join(", ")}`);

  // Répondre immédiatement — pipeline async en background
  res.status(202).json({ received: true, processing: true, deal_id, filesCount: uploadedFiles.length });

  // Process in background
  try {
    const result = await runDeckFrontendPipeline({
      deal_id,
      analysis_id,
      additional_context: additional_context || undefined,
      user_email,
      files: uploadedFiles.map((f) => ({
        buffer: f.buffer,
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
      })),
    });
    console.log(`[server] Deck frontend pipeline result:`, {
      success: result.success,
      dealId: result.dealId,
      companyName: result.companyName,
      cancelled: result.cancelled,
      duration: `${result.durationMs}ms`,
    });
  } catch (error: any) {
    console.error(`[server] Deck frontend pipeline error:`, error.message);
  }
});

// Test endpoint for deck frontend pipeline (synchrone — attend le résultat)
app.post("/test/analyze-deck", upload.any(), async (req, res) => {
  const uploadedFiles = req.files as Express.Multer.File[] | undefined;
  const { deal_id, analysis_id, additional_context, user_email } = req.body;

  if (!uploadedFiles?.length || !deal_id || !analysis_id || !user_email) {
    res.status(400).json({
      error: "Champs requis: file(s) (PDF/Excel/Word/Image), deal_id, analysis_id, user_email",
    });
    return;
  }

  try {
    const result = await runDeckFrontendPipeline({
      deal_id,
      analysis_id,
      additional_context: additional_context || undefined,
      user_email,
      files: uploadedFiles.map((f) => ({
        buffer: f.buffer,
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
      })),
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Email sync — triggers Trigger.dev task
// Called by start-email-sync (Supabase Edge Function) or curl for testing
app.post("/webhook/email-sync", async (req, res) => {
  console.log(`[server] POST /webhook/email-sync → triggering Trigger.dev task`);
  try {
    const handle = await tasks.trigger<typeof emailSyncTask>("email-sync", req.body);
    res.json({ received: true, runId: handle.id });
  } catch (error: any) {
    console.error(`[server] Email sync trigger error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint — same as webhook, triggers Trigger.dev task
app.post("/test/email-sync", async (req, res) => {
  try {
    const handle = await tasks.trigger<typeof emailSyncTask>("email-sync", req.body);
    res.json({ triggered: true, runId: handle.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send recap email based on actual reports stored in DB for a user
// POST /test/send-recap { user_id, to_email, account_email? }
app.post("/test/send-recap", async (req, res) => {
  const { user_id, to_email, account_email } = req.body;
  if (!user_id || !to_email) {
    res.status(400).json({ error: "user_id and to_email required" });
    return;
  }

  try {
    // Query reports created from historical analysis (processed matches)
    const { data: matches } = await supabase
      .from("email_company_matches")
      .select("company_id, email_subject, email_date, matched_domain")
      .eq("user_id", user_id)
      .eq("is_potential_report", true)
      .in("report_processing_status", ["processed", "sent"]);

    if (!matches || matches.length === 0) {
      res.status(404).json({ error: "No processed reports found for this user" });
      return;
    }

    // Get the actual reports from company_reports for these companies
    const companyIds = [...new Set(matches.map((m) => m.company_id))];
    const { data: reports } = await supabase
      .from("company_reports")
      .select("id, company_id, report_period, report_type, created_at")
      .in("company_id", companyIds)
      .order("created_at", { ascending: false });

    // Get company names
    const { data: companies } = await supabase
      .from("portfolio_companies")
      .select("id, company_name")
      .in("id", companyIds);
    const nameMap = new Map((companies || []).map((c) => [c.id, c.company_name]));

    // Count files per report
    const reportIds = (reports || []).map((r) => r.id);
    const { data: files } = await supabase
      .from("report_files")
      .select("report_id")
      .in("report_id", reportIds);
    const fileCountMap = new Map<string, number>();
    for (const f of files || []) {
      fileCountMap.set(f.report_id, (fileCountMap.get(f.report_id) || 0) + 1);
    }

    // Build recap items from actual DB data
    const recapItems: ReportRecapItem[] = (reports || []).map((r) => ({
      companyName: nameMap.get(r.company_id) || null,
      reportPeriod: r.report_period || null,
      reportType: r.report_type || null,
      emailSubject: "",
      emailDate: r.created_at,
      filesCount: fileCountMap.get(r.id) || 0,
    }));

    const html = buildRecapEmailHtml(
      recapItems,
      { totalExtracted: recapItems.length, durationMs: 0 },
      account_email || "sync@alboteam.com"
    );

    const sent = await sendEmail({
      accountId: "_6sjZD6zSUmIEb1N8gqAow",
      to: [{ identifier: to_email }],
      subject: `Albote | ${recapItems.length} reports extraits`,
      body: html,
    });

    res.json({ sent: !!sent, reportsCount: recapItems.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Worker server running on port ${PORT}`);
});
