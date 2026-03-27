/**
 * Batch processor: fetch report@ emails from Unipile with cursor pagination,
 * skip already-processed ones, and run 50 new reports through the pipeline.
 */
import "dotenv/config";
import { runReportPipeline } from "../src/pipelines/report-pipeline";
import { supabase } from "../src/lib/supabase";

const UNIPILE_DSN = (() => {
  const raw = (process.env.UNIPILE_DSN || "").trim();
  return raw.startsWith("http") ? raw : `https://${raw}`;
})();
const UNIPILE_API_KEY = (process.env.UNIPILE_API_KEY || "").trim();
const ACCOUNT_ID = "_6sjZD6zSUmIEb1N8gqAow";
const TARGET = parseInt(process.env.BATCH_TARGET || "50");

interface UnipileEmail {
  id: string;
  subject: string;
  date: string;
  to_attendees: { identifier: string }[];
  from_attendee: { identifier: string; display_name: string };
  [key: string]: unknown;
}

async function fetchPage(cursor?: string): Promise<{ items: UnipileEmail[]; cursor?: string }> {
  const url = cursor
    ? `${UNIPILE_DSN}/api/v1/emails?account_id=${ACCOUNT_ID}&limit=50&cursor=${cursor}`
    : `${UNIPILE_DSN}/api/v1/emails?account_id=${ACCOUNT_ID}&limit=50`;

  const res = await fetch(url, {
    headers: { "X-API-KEY": UNIPILE_API_KEY, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Unipile fetch failed: ${res.status}`);
  return res.json() as Promise<{ items: UnipileEmail[]; cursor?: string }>;
}

function isReportEmail(email: UnipileEmail): boolean {
  return (email.to_attendees || []).some(
    (a) => a.identifier?.toLowerCase() === "report@alboteam.com"
  );
}

async function getProcessedThreadIds(): Promise<Set<string>> {
  const { data } = await supabase
    .from("company_reports")
    .select("source_thread_id")
    .not("source_thread_id", "is", null);
  return new Set((data || []).map((r) => r.source_thread_id).filter(Boolean));
}

async function main() {
  console.log(`\n========== BATCH REPORT PROCESSOR ==========`);
  console.log(`Target: ${TARGET} report@ emails\n`);

  const processedThreads = await getProcessedThreadIds();
  console.log(`Already processed: ${processedThreads.size} thread IDs in DB\n`);

  const reportEmails: UnipileEmail[] = [];
  let cursor: string | undefined;
  let totalFetched = 0;
  let pageNum = 0;

  // Phase 1: Collect report@ emails
  while (reportEmails.length < TARGET) {
    pageNum++;
    const page = await fetchPage(cursor);
    totalFetched += page.items.length;

    for (const email of page.items) {
      if (!isReportEmail(email)) continue;
      // Skip already processed
      if (processedThreads.has(email.id)) continue;
      reportEmails.push(email);
      if (reportEmails.length >= TARGET) break;
    }

    console.log(`Page ${pageNum}: ${page.items.length} emails, ${reportEmails.length}/${TARGET} report@ collected (total scanned: ${totalFetched})`);

    cursor = page.cursor;
    if (!cursor || page.items.length === 0) {
      console.log(`No more pages. Collected ${reportEmails.length} report@ emails.`);
      break;
    }
  }

  console.log(`\n========== PROCESSING ${reportEmails.length} REPORTS ==========\n`);

  // Phase 2: Process sequentially
  const results: Array<{
    idx: number;
    emailId: string;
    subject: string;
    from: string;
    date: string;
    success: boolean;
    companyName?: string;
    error?: string;
    durationMs: number;
  }> = [];

  for (let i = 0; i < reportEmails.length; i++) {
    const email = reportEmails[i];
    const from = email.from_attendee?.identifier || "unknown";
    console.log(`[${i + 1}/${reportEmails.length}] "${email.subject}" (${from}, ${email.date})`);

    try {
      const result = await runReportPipeline(
        { ...email, email_id: email.id },
        { skipNotification: true }
      );
      results.push({
        idx: i + 1,
        emailId: email.id,
        subject: email.subject,
        from,
        date: email.date,
        success: result.success,
        companyName: result.companyName,
        error: result.error,
        durationMs: result.durationMs,
      });
      console.log(`  → ${result.success ? "✓" : "✗"} ${result.companyName || result.error} (${result.durationMs}ms)\n`);
    } catch (err: any) {
      results.push({
        idx: i + 1,
        emailId: email.id,
        subject: email.subject,
        from,
        date: email.date,
        success: false,
        error: err.message,
        durationMs: 0,
      });
      console.log(`  → ✗ CRASH: ${err.message}\n`);
    }
  }

  // Phase 3: Summary
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const companyNotFound = failed.filter((r) => r.error === "Company not found");
  const otherErrors = failed.filter((r) => r.error !== "Company not found" && !r.error?.includes("Not addressed to report@"));
  const filtered = failed.filter((r) => r.error?.includes("Not addressed to report@"));

  console.log(`\n========== BATCH SUMMARY ==========`);
  console.log(`Total processed: ${results.length}`);
  console.log(`Succeeded: ${succeeded.length}`);
  console.log(`Company not found: ${companyNotFound.length}`);
  console.log(`Other errors: ${otherErrors.length}`);
  console.log(`Filtered (wrong destination): ${filtered.length}`);

  if (succeeded.length > 0) {
    console.log(`\n--- SUCCEEDED ---`);
    for (const r of succeeded) {
      console.log(`  ${r.idx}. "${r.subject}" → ${r.companyName} (${r.durationMs}ms)`);
    }
  }

  if (companyNotFound.length > 0) {
    console.log(`\n--- COMPANY NOT FOUND ---`);
    for (const r of companyNotFound) {
      console.log(`  ${r.idx}. "${r.subject}" from ${r.from}`);
    }
  }

  if (otherErrors.length > 0) {
    console.log(`\n--- OTHER ERRORS ---`);
    for (const r of otherErrors) {
      console.log(`  ${r.idx}. "${r.subject}" → ${r.error}`);
    }
  }

  console.log(`\n========== DONE ==========\n`);
}

main().catch(console.error);
