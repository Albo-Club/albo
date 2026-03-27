/**
 * Metric normalization: canonical keys, aliases, categories.
 *
 * - canonical_key groups synonyms under one name (for charts)
 * - metric_key is preserved as-is (for detail/audit)
 * - Periods embedded in keys are extracted into report_period
 */

// ── Canonical key → aliases ──────────────────────────────────────────

const ALIASES: Record<string, string[]> = {
  revenue: ["total_revenue", "total_revenues", "net_revenue", "annual_revenue", "annualized_revenue", "turnover", "annual_run_rate"],
  cash_position: ["cash_balance", "cash", "cash_available", "cash_in_bank", "cash_end", "cash_end_of_period", "cash_end_period", "cash_ending", "cash_closing_balance", "treasury"],
  burn_rate: ["monthly_burn", "monthly_burn_rate", "cash_burn", "burn", "cashburn_general"],
  employees: ["headcount", "team_size", "ftes", "employees_fte", "headcount_total", "fte"],
  gross_margin: ["gross_margin_percentage", "gross_margin_pct", "gross_margin_percent", "marge_brute", "gross_margin_rate"],
  ebitda_margin: ["ebitda_margin_pct", "ebitda_margin_percentage", "ebitda_pct"],
  customers: ["total_customers", "active_customers", "paying_customers", "clients"],
  arr: ["annual_recurring_revenue"],
  mrr: ["monthly_recurring_revenue"],
  net_result: ["net_income", "net_profit"],
  operating_result: ["operating_income", "operating_profit"],
  staff_costs: ["personnel_costs", "payroll", "salaries"],
  churn_rate: ["monthly_churn", "annual_churn"],
  aum: ["assets_under_management", "total_aum", "aum_total"],
  runway_months: ["runway", "cash_runway", "cash_runway_months"],
  burn_rate_net: ["net_burn", "net_burn_rate", "net_monthly_burn"],
  cogs: ["cost_of_goods_sold", "cost_of_sales", "aprovisionamientos"],
  ebitda: ["ebitda_value"],
  gmv: ["gross_merchandise_value", "total_gmv"],
};

// Build reverse lookup: alias → canonical
const ALIAS_TO_CANONICAL = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL.set(alias, canonical);
  }
}

// ── Categories ───────────────────────────────────────────────────────

type MetricCategory = "revenue" | "cash" | "profitability" | "growth" | "clients" | "team" | "fund" | "other";

const CATEGORY_RULES: Array<{ pattern: RegExp; category: MetricCategory }> = [
  { pattern: /^(revenue|arr|mrr|gmv|sales|turnover|net_revenue|total_revenue)/, category: "revenue" },
  { pattern: /^(cash|burn|runway|treasury|debt|financing)/, category: "cash" },
  { pattern: /^(ebitda|gross_margin|operating_result|net_result|pretax|cogs|other_opex|staff_costs|depreciation|financial_result|tax|margin)/, category: "profitability" },
  { pattern: /^(growth|yoy|mom|conversion|acquisition|cac|ltv|nps|retention)/, category: "growth" },
  { pattern: /^(customers|clients|users|active_user|registered|contracts|subscribers|accounts_connected)/, category: "clients" },
  { pattern: /^(employees|headcount|team_size|ftes|fte|hiring)/, category: "team" },
  { pattern: /^(tvpi|dpi|rvpi|irr|moic|commitments|called_capital|distributions|nav|aum)/, category: "fund" },
];

function detectCategory(key: string): MetricCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(key)) return rule.category;
  }
  return "other";
}

// ── Known prefixes (preserved, not stripped) ─────────────────────────

const KNOWN_PREFIXES = ["budget_", "cumulative_", "cumulative_budget_", "forecast_"];

// ── Period extraction from key ───────────────────────────────────────

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const MONTH_DISPLAY: Record<string, string> = {
  january: "January", february: "February", march: "March", april: "April",
  may: "May", june: "June", july: "July", august: "August",
  september: "September", october: "October", november: "November", december: "December",
};

/**
 * Try to extract a period embedded in the metric key.
 * Examples:
 *   "revenue_january_2025" → { cleanKey: "revenue", extractedPeriod: "January 2025" }
 *   "ebitda_2024" → { cleanKey: "ebitda", extractedPeriod: "2024" }
 *   "revenue_q4" → { cleanKey: "revenue", extractedPeriod: "Q4" }
 *   "revenue_q3_2025" → { cleanKey: "revenue", extractedPeriod: "Q3 2025" }
 *   "revenue" → { cleanKey: "revenue", extractedPeriod: null }
 */
function extractPeriodFromKey(key: string): { cleanKey: string; extractedPeriod: string | null } {
  // Pattern: _month_year (e.g., _january_2025, _november_2024)
  for (const month of MONTH_NAMES) {
    const monthYearRegex = new RegExp(`_${month}_(\\d{4})$`);
    const match = key.match(monthYearRegex);
    if (match) {
      return {
        cleanKey: key.replace(monthYearRegex, ""),
        extractedPeriod: `${MONTH_DISPLAY[month]} ${match[1]}`,
      };
    }
  }

  // Pattern: _month alone at end (e.g., _december, _november)
  for (const month of MONTH_NAMES) {
    const monthRegex = new RegExp(`_${month}$`);
    if (monthRegex.test(key)) {
      return {
        cleanKey: key.replace(monthRegex, ""),
        extractedPeriod: MONTH_DISPLAY[month],
      };
    }
  }

  // Pattern: _qN_year (e.g., _q4_2025)
  const qYearMatch = key.match(/_q(\d)_(\d{4})$/);
  if (qYearMatch) {
    return {
      cleanKey: key.replace(/_q\d_\d{4}$/, ""),
      extractedPeriod: `Q${qYearMatch[1]} ${qYearMatch[2]}`,
    };
  }

  // Pattern: _qN alone (e.g., _q4)
  const qMatch = key.match(/_q(\d)$/);
  if (qMatch) {
    return {
      cleanKey: key.replace(/_q\d$/, ""),
      extractedPeriod: `Q${qMatch[1]}`,
    };
  }

  // Pattern: _year alone at end (e.g., _2024, _2025) — but NOT if key is very short
  const yearMatch = key.match(/_(\d{4})$/);
  if (yearMatch && key.replace(/_\d{4}$/, "").length > 2) {
    return {
      cleanKey: key.replace(/_\d{4}$/, ""),
      extractedPeriod: yearMatch[1],
    };
  }

  return { cleanKey: key, extractedPeriod: null };
}

// ── Main function ────────────────────────────────────────────────────

export interface NormalizedMetric {
  /** Original key as-is */
  originalKey: string;
  /** Canonical key for grouping/charting */
  canonicalKey: string;
  /** Category for UI grouping */
  category: MetricCategory;
  /** Period extracted from key (if any) — to be used as report_period fallback */
  extractedPeriod: string | null;
}

export function normalizeMetricKey(rawKey: string): NormalizedMetric {
  const key = rawKey.toLowerCase().trim();

  // 1. Strip known prefix, normalize base, then re-add prefix
  let prefix = "";
  let baseKey = key;
  for (const p of KNOWN_PREFIXES) {
    if (key.startsWith(p)) {
      // Use longest matching prefix
      if (p.length > prefix.length) {
        prefix = p;
        baseKey = key.slice(p.length);
      }
    }
  }

  // 2. Extract period from base key
  const { cleanKey, extractedPeriod } = extractPeriodFromKey(baseKey);

  // 3. Resolve alias → canonical
  const canonical = ALIAS_TO_CANONICAL.get(cleanKey) || cleanKey;

  // 4. Re-add prefix
  const canonicalKey = prefix ? `${prefix}${canonical}` : canonical;

  // 5. Detect category (based on canonical without prefix)
  const category = detectCategory(canonical);

  return {
    originalKey: rawKey,
    canonicalKey,
    category,
    extractedPeriod,
  };
}

// ── Period sort date ─────────────────────────────────────────────────

const MONTH_TO_NUM: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/**
 * Parse a report_period string into a sortable Date.
 * Handles: "January 2026", "September - Q3 2025", "Q4 2025", "2025",
 *          "November - December 2025", "September_-_Q3_2025"
 * Returns the FIRST month of the period for sorting.
 */
export function parsePeriodToSortDate(period: string): Date | null {
  if (!period) return null;

  // Normalize: replace underscores with spaces, trim
  const p = period.replace(/_/g, " ").trim();

  // Use Date.UTC to avoid timezone offset issues

  // Pattern 1: "Month Year" or "Month - ... Year" (take first month + FIRST year)
  // Use .*? with FIRST \d{4} to avoid grabbing the last year in multi-year periods
  // e.g. "December 2025 - January 2026" → December 2025 (not 2026)
  const monthYearMatch = p.match(/^([a-z]+)\s.*?(\d{4})/i) || p.match(/^([a-z]+)\s+(\d{4})$/i);
  if (monthYearMatch) {
    const monthNum = MONTH_TO_NUM[monthYearMatch[1].toLowerCase()];
    const year = parseInt(monthYearMatch[2]);
    if (monthNum && year) return new Date(Date.UTC(year, monthNum - 1, 1));
  }

  // Pattern 2: "Q1 2025" / "Q2 2025" etc.
  const qMatch = p.match(/^Q(\d)\s+(\d{4})$/i);
  if (qMatch) {
    const quarter = parseInt(qMatch[1]);
    const year = parseInt(qMatch[2]);
    const month = (quarter - 1) * 3; // Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct
    return new Date(Date.UTC(year, month, 1));
  }

  // Pattern 3: "Q1" alone (no year — use current year)
  const qAlone = p.match(/^Q(\d)$/i);
  if (qAlone) {
    const quarter = parseInt(qAlone[1]);
    const month = (quarter - 1) * 3;
    return new Date(Date.UTC(new Date().getUTCFullYear(), month, 1));
  }

  // Pattern 4: "2025" (year alone → Jan 1)
  const yearMatch = p.match(/^(\d{4})$/);
  if (yearMatch) {
    return new Date(Date.UTC(parseInt(yearMatch[1]), 0, 1));
  }

  // Pattern 5: "Month" alone (no year — use current year)
  const monthAlone = MONTH_TO_NUM[p.toLowerCase()];
  if (monthAlone) {
    return new Date(Date.UTC(new Date().getUTCFullYear(), monthAlone - 1, 1));
  }

  return null;
}

/**
 * Normalize a report_period string for display consistency.
 * Replaces underscores, fixes spacing around dashes.
 * "September_-_Q3_2025" → "September - Q3 2025"
 */
export function normalizePeriodDisplay(period: string): string {
  return period
    .replace(/_/g, " ")
    .replace(/\s+-\s+/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Period enrichment ───────────────────────────────────────────────

/**
 * Enrich a period that has no year with the year inferred from a fallback period.
 *
 * Logic: if the metric's month is AFTER the report's month in calendar order,
 * it belongs to the previous year (the data precedes the report period).
 *
 * Examples (fallback = "February 2026"):
 *   "February"  → "February 2026"  (same month = same year)
 *   "January"   → "January 2026"   (before report month = same year)
 *   "April"     → "April 2025"     (after report month = previous year)
 *   "December"  → "December 2025"  (after report month = previous year)
 *   "Q4"        → "Q4 2025"        (Q4 starts Oct > Feb = previous year)
 *   "Q1 2025"   → "Q1 2025"        (already has year = unchanged)
 *   "2025"      → "2025"           (year-only = unchanged)
 */
export function enrichPeriodWithYear(extractedPeriod: string, fallbackPeriod: string): string {
  if (!extractedPeriod || !fallbackPeriod) return extractedPeriod || fallbackPeriod;

  // Already has a year → return as-is
  if (/\d{4}/.test(extractedPeriod)) return extractedPeriod;

  // Parse the fallback period to get reference month + year
  const fallbackMonthMatch = fallbackPeriod.match(/^([a-z]+)\s+(\d{4})$/i);
  const fallbackYearMatch = fallbackPeriod.match(/(\d{4})/);
  if (!fallbackYearMatch) return extractedPeriod; // Can't infer year

  const refYear = parseInt(fallbackYearMatch[1]);
  const refMonthNum = fallbackMonthMatch
    ? MONTH_TO_NUM[fallbackMonthMatch[1].toLowerCase()] || 0
    : 0;

  // Case 1: extractedPeriod is a month name ("February", "April")
  const monthNum = MONTH_TO_NUM[extractedPeriod.toLowerCase()];
  if (monthNum && refMonthNum) {
    const year = monthNum > refMonthNum ? refYear - 1 : refYear;
    return `${extractedPeriod} ${year}`;
  }

  // Case 2: extractedPeriod is a quarter ("Q4", "Q1")
  const qMatch = extractedPeriod.match(/^Q(\d)$/i);
  if (qMatch && refMonthNum) {
    const quarterStartMonth = (parseInt(qMatch[1]) - 1) * 3 + 1; // Q1=1, Q2=4, Q3=7, Q4=10
    const year = quarterStartMonth > refMonthNum ? refYear - 1 : refYear;
    return `${extractedPeriod} ${year}`;
  }

  // Fallback: append the year from fallback
  return `${extractedPeriod} ${refYear}`;
}

// ── Convenience: normalize metrics for DB ingestion ─────────────────

export interface DbMetricInput {
  metric_key: string;
  metric_value: string;
  metric_type: string;
  report_period: string;
}

export interface DbMetricOutput extends DbMetricInput {
  /** Canonical key for grouping/charting (e.g. "revenue" for "total_revenue") */
  canonical_key: string;
  /** Category for UI grouping */
  metric_category: MetricCategory;
  /** Sortable date derived from report_period */
  period_sort_date: string | null;
}

/**
 * Normalize a batch of metrics for DB ingestion:
 * - Extract period from key (revenue_february → revenue + February)
 * - Resolve aliases to canonical keys
 * - Enrich period with year from fallback
 * - Populate canonical_key, metric_category, period_sort_date
 * - Deduplicate on (canonical_key, period)
 */
export function normalizeMetricsForDb(
  metrics: DbMetricInput[],
  fallbackPeriod: string
): DbMetricOutput[] {
  const dedupMap = new Map<string, DbMetricOutput>();

  for (const m of metrics) {
    const normalized = normalizeMetricKey(m.metric_key);

    // Determine period: extracted from key > metric's own period > fallback
    let period = m.report_period;
    if (normalized.extractedPeriod) {
      period = enrichPeriodWithYear(normalized.extractedPeriod, fallbackPeriod);
    } else if (!period || period === fallbackPeriod) {
      // Keep as-is (already the fallback or a real period from Claude)
    }

    // Compute period_sort_date for time-series ordering
    const sortDate = parsePeriodToSortDate(period);
    const periodSortDate = sortDate ? sortDate.toISOString().slice(0, 10) : null;

    const dedupKey = `${normalized.canonicalKey}|${period}`;
    // Last value wins (Claude's later entries tend to be corrections)
    dedupMap.set(dedupKey, {
      metric_key: normalized.canonicalKey,
      metric_value: m.metric_value,
      metric_type: m.metric_type,
      report_period: period,
      canonical_key: normalized.canonicalKey,
      metric_category: normalized.category,
      period_sort_date: periodSortDate,
    });
  }

  return Array.from(dedupMap.values());
}
