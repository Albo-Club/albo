/**
 * Step: Validate Result
 * Equivalent N8N: "Extract Final Result2"
 *
 * Sanitizes and validates the analysis output.
 */

import type { ReportAnalysis } from "./analyze-report";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TYPES = ["monthly", "bimonthly", "quarterly", "semi-annual", "annual"] as const;

const MONTH_FR_TO_EN: Record<string, string> = {
  janvier: "January", février: "February", mars: "March",
  avril: "April", mai: "May", juin: "June",
  juillet: "July", août: "August", septembre: "September",
  octobre: "October", novembre: "November", décembre: "December",
};

function sanitize(str: string): string {
  return str
    .replace(/['']/g, " ")
    .replace(/[""]/g, "'")
    .replace(/[/\\]/g, "-")
    .replace(/[—–]/g, "-")
    .replace(/[&]/g, "and")
    .replace(/[éèêë]/g, "e").replace(/[àâä]/g, "a").replace(/[ùûü]/g, "u")
    .replace(/[ôö]/g, "o").replace(/[îï]/g, "i").replace(/[ç]/g, "c")
    .replace(/[ÉÈÊË]/g, "E").replace(/[ÀÂÄ]/g, "A").replace(/[ÙÛÜ]/g, "U")
    .replace(/[ÔÖ]/g, "O").replace(/[ÎÏ]/g, "I").replace(/[Ç]/g, "C")
    .replace(/[()[\]@%$!?*+={}|<>~`^#]/g, "")
    .trim();
}

function translatePeriod(str: string): string {
  let result = str;
  for (const [fr, en] of Object.entries(MONTH_FR_TO_EN)) {
    result = result.replace(new RegExp(fr, "gi"), en);
  }
  return result;
}

export function validateResult(analysis: ReportAnalysis): ReportAnalysis & { validationErrors: string[] } {
  const errors: string[] = [];
  const result = { ...analysis };

  // 1. company_id: valid UUID or null
  if (result.companyId && !UUID_REGEX.test(result.companyId)) {
    errors.push(`company_id invalid: ${result.companyId}`);
    result.companyId = null;
    result.companyNotFound = true;
  }

  // 2. company_name: sanitize
  if (result.companyName) {
    result.companyName = sanitize(result.companyName);
  }

  // 3. report_date: YYYY-MM-DD
  if (!DATE_REGEX.test(result.reportDate)) {
    errors.push(`report_date invalid: ${result.reportDate}`);
    const d = new Date(result.reportDate);
    if (!isNaN(d.getTime())) {
      result.reportDate = d.toISOString().split("T")[0];
    }
  }

  // 4. report_period: translate FR→EN, sanitize
  if (result.reportPeriod) {
    result.reportPeriod = sanitize(translatePeriod(result.reportPeriod));
  }

  // 5. storage_period: recalculate
  if (result.reportPeriod) {
    result.storagePeriod = result.reportPeriod.replace(/\s/g, "_");
  }

  // 6. report_type: strict enum
  const typeMap: Record<string, string> = {
    mensuel: "monthly", bimensuel: "bimonthly", trimestriel: "quarterly",
    semestriel: "semi-annual", annuel: "annual",
  };
  const normalizedType = result.reportType?.toLowerCase().trim();
  if (!VALID_TYPES.includes(normalizedType as any)) {
    errors.push(`report_type invalid: ${result.reportType}`);
    result.reportType = (typeMap[normalizedType] || "monthly") as any;
  }

  // 7. metrics: force numeric values, clean keys
  if (result.metrics) {
    const clean: Record<string, number> = {};
    for (const [key, value] of Object.entries(result.metrics)) {
      const cleanKey = key.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      const num = Number(value);
      if (!isNaN(num)) {
        clean[cleanKey] = num;
      }
    }
    if (clean.runway_months && clean.runway_days) delete clean.runway_days;
    if (clean.runway_years) {
      clean.runway_months = clean.runway_years * 12;
      delete clean.runway_years;
    }
    result.metrics = clean;
  }

  // 8. key_highlights: force string array
  result.keyHighlights = result.keyHighlights.map((h) => String(h).replace(/"/g, "'"));

  // 9. workspace_id: validate UUID
  if (result.workspaceId && !UUID_REGEX.test(result.workspaceId)) {
    errors.push(`workspace_id invalid: ${result.workspaceId}`);
    result.workspaceId = null;
  }

  if (errors.length > 0) {
    console.warn("[validate-result] Validation errors:", errors);
  }

  return { ...result, validationErrors: errors };
}
