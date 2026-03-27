import "dotenv/config";
import { supabase } from "../src/lib/supabase.js";
import { sendEmail } from "../src/lib/unipile.js";
import { buildRecapEmailHtml } from "../src/steps/email-sync/build-recap-email.js";

async function main() {
  const userId = "021d842f-1f4f-456d-ad66-4623ac51fab5";

  const { data: matches } = await supabase
    .from("email_company_matches")
    .select("company_id")
    .eq("user_id", userId)
    .eq("is_potential_report", true)
    .in("report_processing_status", ["processed", "sent"]);

  const companyIds = [...new Set((matches || []).map((m) => m.company_id))];

  const { data: reports } = await supabase
    .from("company_reports")
    .select("id, company_id, report_period, report_type, created_at")
    .in("company_id", companyIds)
    .order("created_at", { ascending: false });

  const { data: companies } = await supabase
    .from("portfolio_companies")
    .select("id, company_name")
    .in("id", companyIds);
  const nameMap = new Map((companies || []).map((c) => [c.id, c.company_name]));

  const reportIds = (reports || []).map((r) => r.id);
  const { data: files } = await supabase
    .from("report_files")
    .select("report_id")
    .in("report_id", reportIds);
  const fileCountMap = new Map<string, number>();
  for (const f of files || []) {
    fileCountMap.set(f.report_id, (fileCountMap.get(f.report_id) || 0) + 1);
  }

  const recapItems = (reports || []).map((r) => ({
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
    "samuel.norych@sideangels.com"
  );

  const sent = await sendEmail({
    accountId: "_6sjZD6zSUmIEb1N8gqAow",
    to: [{ identifier: "mael@alboteam.com" }],
    subject: `Albote | ${recapItems.length} reports extraits — Samuel Norych`,
    body: html,
  });

  console.log("Sent:", Boolean(sent), "Reports:", recapItems.length);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
