import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BarChart3, Search, ChevronRight } from "lucide-react";
import { usePortfolioCompanyMetrics, PortfolioCompanyMetric } from "@/hooks/usePortfolioCompanyMetrics";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function snakeToTitle(key: string): string {
  const SPECIAL: Record<string, string> = {
    mrr: "MRR", arr: "ARR", aum: "AuM", ebitda: "EBITDA",
    gmv: "GMV", nrr: "NRR",
  };
  if (SPECIAL[key]) return SPECIAL[key];
  return key
    .replace(/_/g, " ")
    .replace(/\b(mrr|arr|ebitda|aum|gmv|nrr)\b/gi, (m) => m.toUpperCase())
    .split(" ")
    .map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

function formatValue(value: string, type: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;

  if (type === "currency") {
    const abs = Math.abs(num);
    const sign = num < 0 ? "-" : "";
    if (abs >= 1_000_000_000) return `${sign}${(abs / 1e9).toFixed(1).replace(".", ",")} Md€`;
    if (abs >= 1_000_000) return `${sign}${(abs / 1e6).toFixed(1).replace(".", ",")} M€`;
    if (abs >= 1_000) return `${sign}${Math.round(abs / 1e3).toLocaleString("fr-FR")} k€`;
    return `${sign}${Math.round(abs).toLocaleString("fr-FR")} €`;
  }
  if (type === "percentage") {
    const pct = Math.abs(num) <= 1 ? num * 100 : num;
    return `${pct.toFixed(1).replace(".", ",")}%`;
  }
  if (type === "months") {
    return `${num} mois`;
  }
  return new Intl.NumberFormat("fr-FR").format(Math.round(num));
}

/* Period sorting helper */
const MONTHS_ORDER: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function periodToSortKey(period: string | null): string {
  if (!period) return "0000-00";
  const lower = period.toLowerCase().trim();
  const monthYear = lower.match(/^(\w+)\s+(\d{4})$/);
  if (monthYear) {
    const m = MONTHS_ORDER[monthYear[1]] || 0;
    return `${monthYear[2]}-${String(m).padStart(2, "0")}`;
  }
  const qMatch = lower.match(/^q(\d)\s+(\d{4})$/);
  if (qMatch) return `${qMatch[2]}-Q${qMatch[1]}`;
  return period;
}

/* Category config */
const CATEGORY_ORDER: { key: string; label: string }[] = [
  { key: "revenue", label: "Revenus" },
  { key: "profitability", label: "Rentabilité" },
  { key: "cash", label: "Trésorerie" },
  { key: "growth", label: "Croissance" },
  { key: "clients", label: "Clients" },
  { key: "team", label: "Équipe" },
  { key: "fund", label: "Fonds" },
  { key: "other", label: "Autres" },
];

/* Chart colors */
const CHART_COLORS = [
  "hsl(var(--primary))",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

/* Effective canonical key */
function effectiveCanonical(m: PortfolioCompanyMetric): string {
  return m.canonical_key || m.metric_key;
}

function effectiveCategory(m: PortfolioCompanyMetric): string {
  return m.metric_category || "other";
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface CompanyMetricsModuleProps {
  companyId: string;
  displayedMetrics: string[];
}

export function CompanyMetricsModule({ companyId, displayedMetrics: initialDisplayed }: CompanyMetricsModuleProps) {
  const queryClient = useQueryClient();
  const { metrics, isLoading } = usePortfolioCompanyMetrics(companyId);
  const [search, setSearch] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("__all__");
  const [displayedMetrics, setDisplayedMetrics] = useState<Set<string>>(new Set(initialDisplayed || []));
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    new Set(CATEGORY_ORDER.filter((c) => c.key !== "other").map((c) => c.key))
  );

  // Fetch report names for source column
  const reportIds = useMemo(() => {
    const ids = new Set<string>();
    metrics.forEach((m) => { if (m.source_report_id) ids.add(m.source_report_id); });
    return [...ids];
  }, [metrics]);

  const { data: reportNames = {} } = useQuery({
    queryKey: ["report-names", reportIds],
    queryFn: async () => {
      if (reportIds.length === 0) return {};
      const { data } = await supabase
        .from("company_reports")
        .select("id, report_title, email_subject")
        .in("id", reportIds);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => {
        map[r.id] = r.report_title || r.email_subject || "Report";
      });
      return map;
    },
    enabled: reportIds.length > 0,
  });

  // Toggle displayed_metrics mutation (uses canonical_key)
  const toggleMutation = useMutation({
    mutationFn: async (newSet: string[]) => {
      const { error } = await supabase
        .from("portfolio_companies")
        .update({ displayed_metrics: newSet })
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio-company", companyId] });
    },
  });

  const handleToggle = (canonicalKey: string) => {
    setDisplayedMetrics((prev) => {
      const next = new Set(prev);
      next.has(canonicalKey) ? next.delete(canonicalKey) : next.add(canonicalKey);
      const arr = [...next];
      toggleMutation.mutate(arr);
      return next;
    });
  };

  // Unique canonical keys grouped by category
  const groupedCanonicals = useMemo(() => {
    const map = new Map<string, Map<string, number>>(); // category → canonical → count
    metrics.forEach((m) => {
      const cat = effectiveCategory(m);
      const ck = effectiveCanonical(m);
      if (!map.has(cat)) map.set(cat, new Map());
      const catMap = map.get(cat)!;
      catMap.set(ck, (catMap.get(ck) || 0) + 1);
    });
    return map;
  }, [metrics]);

  // Unique periods sorted by period_sort_date
  const uniquePeriods = useMemo(() => {
    const periodMap = new Map<string, string>(); // report_period → period_sort_date
    metrics.forEach((m) => {
      if (m.report_period && !periodMap.has(m.report_period)) {
        periodMap.set(m.report_period, m.period_sort_date || "9999-12-31");
      }
    });
    return [...periodMap.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([period]) => period);
  }, [metrics]);

  // Count data points per canonical_key
  const historicalCounts = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    metrics.forEach((m) => {
      const ck = effectiveCanonical(m);
      if (!counts.has(ck)) counts.set(ck, new Set());
      if (m.period_sort_date) counts.get(ck)!.add(m.period_sort_date);
    });
    return counts;
  }, [metrics]);

  // Filter metrics by search + period
  const filteredMetrics = useMemo(() => {
    let result = metrics;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((m) =>
        m.metric_key.toLowerCase().includes(q) ||
        snakeToTitle(m.metric_key).toLowerCase().includes(q) ||
        effectiveCanonical(m).toLowerCase().includes(q) ||
        snakeToTitle(effectiveCanonical(m)).toLowerCase().includes(q)
      );
    }
    if (selectedPeriod !== "__all__") {
      result = result.filter((m) => m.report_period === selectedPeriod);
    }
    return result;
  }, [metrics, search, selectedPeriod]);

  // Sort: canonical_key ASC, metric_key ASC, period_sort_date DESC
  const sortedMetrics = useMemo(() => {
    return [...filteredMetrics].sort((a, b) => {
      const ckComp = effectiveCanonical(a).localeCompare(effectiveCanonical(b));
      if (ckComp !== 0) return ckComp;
      const keyComp = a.metric_key.localeCompare(b.metric_key);
      if (keyComp !== 0) return keyComp;
      const dateA = a.period_sort_date || "";
      const dateB = b.period_sort_date || "";
      return dateB.localeCompare(dateA);
    });
  }, [filteredMetrics]);

  // Build chart data from selected canonical_keys, using period_sort_date for order
  const chartData = useMemo(() => {
    if (displayedMetrics.size === 0) return [];

    // Map: period_sort_date → { report_period label, values per ck }
    const dateMap = new Map<string, { label: string; values: Map<string, number> }>();

    metrics.forEach((m) => {
      const ck = effectiveCanonical(m);
      if (!displayedMetrics.has(ck) || !m.period_sort_date) return;
      const sortDate = m.period_sort_date;
      if (!dateMap.has(sortDate)) {
        dateMap.set(sortDate, { label: m.report_period || sortDate, values: new Map() });
      }
      const entry = dateMap.get(sortDate)!;
      // Keep first value per canonical_key + period_sort_date
      if (!entry.values.has(ck)) {
        const val = parseFloat(m.metric_value);
        if (!isNaN(val)) entry.values.set(ck, val);
      }
    });

    const sortedDates = [...dateMap.keys()].sort((a, b) => a.localeCompare(b));

    return sortedDates.map((date) => {
      const entry = dateMap.get(date)!;
      const point: Record<string, any> = { period: entry.label };
      [...displayedMetrics].forEach((ck) => {
        const val = entry.values.get(ck);
        if (val !== undefined) point[ck] = val;
      });
      return point;
    });
  }, [metrics, displayedMetrics]);

  const hasPercentage = useMemo(() => {
    return metrics.some((m) => displayedMetrics.has(effectiveCanonical(m)) && m.metric_type === "percentage");
  }, [metrics, displayedMetrics]);

  const hasCurrency = useMemo(() => {
    return metrics.some((m) => displayedMetrics.has(effectiveCanonical(m)) && m.metric_type !== "percentage");
  }, [metrics, displayedMetrics]);

  const getMetricType = (canonicalKey: string) => {
    return metrics.find((m) => effectiveCanonical(m) === canonicalKey)?.metric_type || "number";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <BarChart3 className="h-5 w-5 animate-pulse" />
        Chargement des métriques…
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <BarChart3 className="h-8 w-8" />
        <p className="text-sm">Aucune métrique extraite pour cette entreprise.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category sidebar + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Category sidebar */}
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Métriques par catégorie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-3 pt-0">
            {CATEGORY_ORDER.map(({ key: cat, label }) => {
              const canonicals = groupedCanonicals.get(cat);
              if (!canonicals || canonicals.size === 0) return null;
              const isOpen = openCategories.has(cat);
              return (
                <Collapsible
                  key={cat}
                  open={isOpen}
                  onOpenChange={(open) => {
                    setOpenCategories((prev) => {
                      const next = new Set(prev);
                      open ? next.add(cat) : next.delete(cat);
                      return next;
                    });
                  }}
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted transition-colors">
                    <span className="flex items-center gap-1.5">
                      <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      {label}
                    </span>
                    <Badge variant="secondary" className="text-xs h-5 px-1.5">
                      {canonicals.size}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4 space-y-0.5 mt-0.5">
                    {[...canonicals.entries()]
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([ck, count]) => (
                        <label
                          key={ck}
                          className="flex items-center gap-2 rounded-md px-2 py-1 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={displayedMetrics.has(ck)}
                            onCheckedChange={() => handleToggle(ck)}
                            className="h-3.5 w-3.5"
                          />
                          <span className="truncate flex-1">{snakeToTitle(ck)}</span>
                          <span className="text-xs text-muted-foreground">({count})</span>
                        </label>
                      ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </CardContent>
        </Card>

        {/* Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Évolution des métriques sélectionnées</CardTitle>
          </CardHeader>
          <CardContent>
            {displayedMetrics.size === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <BarChart3 className="h-10 w-10 opacity-30" />
                <p className="text-sm">Sélectionnez des métriques dans le panneau ou le tableau pour les visualiser</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    tickFormatter={(v) => {
                      if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
                      if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
                      return v;
                    }}
                    hide={!hasCurrency}
                  />
                  {hasPercentage && (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 100]}
                    />
                  )}
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--popover-foreground))",
                    }}
                    formatter={(value: number, name: string) => [
                      formatValue(String(value), getMetricType(name)),
                      snakeToTitle(name),
                    ]}
                  />
                  <Legend
                    formatter={(value: string) => snakeToTitle(value)}
                    wrapperStyle={{ fontSize: "12px", cursor: "pointer" }}
                  />
                  {[...displayedMetrics].map((ck, i) => {
                    const type = getMetricType(ck);
                    return (
                      <Line
                        key={ck}
                        yAxisId={type === "percentage" ? "right" : "left"}
                        type="monotone"
                        dataKey={ck}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Metrics Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Toutes les métriques</CardTitle>
            <Badge variant="secondary">{metrics.length}</Badge>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filtrer par nom de métrique…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Toutes les périodes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes les périodes</SelectItem>
                {uniquePeriods.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Graph</TableHead>
                  <TableHead>Groupe</TableHead>
                  <TableHead>Métrique</TableHead>
                  <TableHead>Valeur</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Historique</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMetrics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Aucune métrique trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedMetrics.map((metric) => {
                    const ck = effectiveCanonical(metric);
                    const count = historicalCounts.get(ck)?.size || 0;
                    return (
                      <TableRow key={metric.id}>
                        <TableCell>
                          <Checkbox
                            checked={displayedMetrics.has(ck)}
                            onCheckedChange={() => handleToggle(ck)}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {snakeToTitle(ck)}
                        </TableCell>
                        <TableCell className="font-medium">{snakeToTitle(metric.metric_key)}</TableCell>
                        <TableCell className="tabular-nums font-medium">
                          {formatValue(metric.metric_value, metric.metric_type)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{metric.report_period || "-"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {count > 0 ? `${count} mois` : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                          {metric.source_report_id ? (reportNames[metric.source_report_id] || "-") : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(metric.updated_at), "dd MMM yyyy", { locale: fr })}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
