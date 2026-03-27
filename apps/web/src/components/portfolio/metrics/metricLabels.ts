export const METRIC_LABELS: Record<string, string> = {
  revenue: "Revenue",
  cash_position: "Cash Position",
  ebitda: "EBITDA",
  burn_rate: "Burn Rate",
  burn_rate_net: "Net Burn Rate",
  runway_months: "Runway",
  gross_margin: "Gross Margin",
  employees: "Employees",
  customers: "Customers",
  arr: "ARR",
  mrr: "MRR",
  net_result: "Net Result",
  operating_result: "Operating Result",
  staff_costs: "Staff Costs",
  churn_rate: "Churn Rate",
  aum: "AUM",
  cogs: "COGS",
  gmv: "GMV",
  ebitda_margin: "EBITDA Margin",
  online_revenue: "Online Revenue",
  offline_revenue: "Offline Revenue",
  other_opex: "Other Opex",
  financial_result: "Financial Result",
};

export function getMetricLabel(key: string): string {
  return METRIC_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const compactEur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const compactNum = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMetricValue(raw: string, metricType: string): string {
  const v = parseFloat(raw);
  if (isNaN(v)) return raw;

  switch (metricType) {
    case "currency":
      return compactEur.format(v);
    case "percentage":
      return `${v.toFixed(1)}%`;
    case "months":
      return `${Math.round(v)} mois`;
    case "number":
      return v >= 1000 ? compactNum.format(v) : String(v);
    default:
      return String(v);
  }
}

export function formatYAxis(raw: number, metricType: string): string {
  if (isNaN(raw)) return "";
  switch (metricType) {
    case "currency":
      return compactEur.format(raw);
    case "percentage":
      return `${raw.toFixed(1)}%`;
    case "months":
      return `${Math.round(raw)}`;
    case "number":
      return raw >= 1000 ? compactNum.format(raw) : String(raw);
    default:
      return String(raw);
  }
}

export function shortPeriod(period: string): string {
  // "February 2026" → "Feb 26"
  const parts = period.split(" ");
  if (parts.length < 2) return period;
  const month = parts[0].substring(0, 3);
  const year = parts[parts.length - 1].slice(-2);
  return `${month} ${year}`;
}

export const CATEGORY_LABELS: Record<string, string> = {
  revenue: "Revenue",
  cash: "Cash",
  profitability: "Profitability",
  growth: "Growth",
  clients: "Clients",
  team: "Team",
  fund: "Fund",
  other: "Other",
};

export const CATEGORY_COLORS: Record<string, string> = {
  revenue: "bg-blue-100 text-blue-700",
  cash: "bg-green-100 text-green-700",
  profitability: "bg-purple-100 text-purple-700",
  growth: "bg-orange-100 text-orange-700",
  clients: "bg-cyan-100 text-cyan-700",
  team: "bg-pink-100 text-pink-700",
  fund: "bg-amber-100 text-amber-700",
  other: "bg-gray-100 text-gray-700",
};
