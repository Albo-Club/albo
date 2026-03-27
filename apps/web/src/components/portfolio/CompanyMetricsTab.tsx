import { useState, useMemo, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BarChart3, ChevronDown, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePortfolioCompanyMetrics, PortfolioCompanyMetric } from "@/hooks/usePortfolioCompanyMetrics";
import { ReportDetailSheet } from "./ReportDetailSheet";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface MetricDataPoint {
  period: string;
  sortDate: string;
  value: number;
  sourceReportId: string | null;
}

interface MetricSeries {
  canonicalKey: string;
  label: string;
  type: "currency" | "percentage" | "number" | "months";
  dataPoints: MetricDataPoint[];
  latestValue: number;
  category: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const SPECIAL_LABELS: Record<string, string> = {
  mrr: "MRR", arr: "ARR", aum: "AuM", ebitda: "EBITDA",
  gmv: "GMV", nrr: "NRR",
};

function snakeToTitle(key: string): string {
  if (SPECIAL_LABELS[key]) return SPECIAL_LABELS[key];
  return key
    .replace(/_/g, " ")
    .replace(/\b(mrr|arr|ebitda|aum|gmv|nrr)\b/gi, (m) => m.toUpperCase())
    .split(" ")
    .map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

function formatMetricValue(value: number, type: string, precise = false): string {
  if (type === "currency") {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1_000_000_000) return `${sign}${(abs / 1e9).toFixed(precise ? 2 : 1).replace(".", ",")}Md €`;
    if (abs >= 1_000_000) return `${sign}${(abs / 1e6).toFixed(precise ? 2 : 1).replace(".", ",")}M €`;
    if (abs >= 1_000) return `${sign}${precise ? (abs / 1e3).toFixed(1).replace(".", ",") : String(Math.round(abs / 1e3))}k €`;
    return `${sign}${Math.round(abs)} €`;
  }
  if (type === "percentage") {
    if (Math.abs(value) <= 1) return `${(value * 100).toFixed(1).replace(".", ",")}%`;
    if (Math.abs(value) < 100) return `${value.toFixed(1).replace(".", ",")}%`;
    return formatMetricValue(value, "currency");
  }
  if (type === "months") {
    return `${Math.round(value)} mois`;
  }
  return new Intl.NumberFormat("fr-FR").format(Math.round(value));
}

/** Full precision value for tooltip */
function formatMetricValueFull(value: number, type: string): string {
  if (type === "currency") {
    const sign = value < 0 ? "-" : "";
    return `${sign}${new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(value)))} €`;
  }
  if (type === "percentage") {
    if (Math.abs(value) <= 1) return `${(value * 100).toFixed(2).replace(".", ",")}%`;
    return `${value.toFixed(2).replace(".", ",")}%`;
  }
  if (type === "months") {
    return `${value.toFixed(1).replace(".", ",")} mois`;
  }
  return new Intl.NumberFormat("fr-FR").format(Math.round(value));
}

const CATEGORY_LABELS: Record<string, string> = {
  revenue: "Revenus",
  cash: "Trésorerie",
  profitability: "Rentabilité",
  growth: "Croissance",
  clients: "Clients",
  team: "Équipe",
  fund: "Fonds",
  other: "Autre",
};

const CATEGORY_ORDER = ["revenue", "profitability", "cash", "growth", "clients", "team", "fund", "other"];

const PRIORITY_KEYS = ["mrr", "arr", "revenue", "aum", "ebitda", "cash_position"];

const INVERSE_METRICS = /burn_rate|churn_rate|outflow_rate/i;

/* ------------------------------------------------------------------ */
/* Build series from portfolio_company_metrics                         */
/* ------------------------------------------------------------------ */

function buildSeriesFromMetrics(metrics: PortfolioCompanyMetric[]): MetricSeries[] {
  const grouped = new Map<string, PortfolioCompanyMetric[]>();

  for (const m of metrics) {
    const ck = m.canonical_key || m.metric_key;
    if (!grouped.has(ck)) grouped.set(ck, []);
    grouped.get(ck)!.push(m);
  }

  const series: MetricSeries[] = [];

  for (const [ck, rows] of grouped) {
    const seen = new Set<string>();
    const dataPoints: MetricDataPoint[] = [];

    for (const r of rows) {
      const sortDate = r.period_sort_date || "";
      if (seen.has(sortDate)) continue;
      seen.add(sortDate);
      const val = parseFloat(r.metric_value);
      if (isNaN(val)) continue;
      dataPoints.push({
        period: r.report_period || sortDate,
        sortDate,
        value: val,
        sourceReportId: r.source_report_id || null,
      });
    }

    dataPoints.sort((a, b) => a.sortDate.localeCompare(b.sortDate));

    if (dataPoints.length === 0) continue;

    const firstRow = rows[0];
    const latestValue = dataPoints[dataPoints.length - 1].value;
    const category = firstRow.metric_category || "other";
    const type = (firstRow.metric_type || "number") as MetricSeries["type"];

    series.push({
      canonicalKey: ck,
      label: snakeToTitle(ck),
      type,
      dataPoints,
      latestValue,
      category,
    });
  }

  return series;
}

/* ------------------------------------------------------------------ */
/* MetricChart (SVG) with tooltip hover + click                        */
/* ------------------------------------------------------------------ */

interface MetricChartProps {
  series: MetricSeries;
  onPointClick?: (reportId: string) => void;
}

function MetricChart({ series, onPointClick }: MetricChartProps) {
  const { dataPoints, type, canonicalKey, label, latestValue } = series;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (dataPoints.length < 2) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">{label}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col items-center justify-center py-6">
          <span className="text-3xl font-bold">{formatMetricValue(latestValue, type)}</span>
          <span className="text-sm text-muted-foreground mt-1">{dataPoints[0]?.period}</span>
        </CardContent>
      </Card>
    );
  }

  const prev = dataPoints[dataPoints.length - 2].value;
  const last = dataPoints[dataPoints.length - 1].value;
  const pctChange = prev !== 0 ? ((last - prev) / Math.abs(prev)) * 100 : 0;
  const isInverse = INVERSE_METRICS.test(canonicalKey);
  const isPositive = isInverse ? pctChange <= 0 : pctChange >= 0;

  const VW = 500, VH = 240;
  const PAD = { top: 40, right: 30, bottom: 60, left: 60 };
  const chartW = VW - PAD.left - PAD.right;
  const chartH = VH - PAD.top - PAD.bottom;

  const values = dataPoints.map(d => d.value);
  let yMin = Math.min(...values);
  let yMax = Math.max(...values);
  const yRange = yMax - yMin || 1;
  yMin -= yRange * 0.1;
  yMax += yRange * 0.1;
  if (yMin > 0 && yMin < yMax * 0.3) yMin = 0;
  const finalRange = yMax - yMin || 1;

  const coords = dataPoints.map((d, i) => ({
    x: PAD.left + (dataPoints.length === 1 ? chartW / 2 : (i / (dataPoints.length - 1)) * chartW),
    y: PAD.top + (1 - (d.value - yMin) / finalRange) * chartH,
  }));

  const trendUp = last >= dataPoints[0].value;
  const lineColor = trendUp ? "#10b981" : "#ef4444";

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x},${PAD.top + chartH} L${coords[0].x},${PAD.top + chartH} Z`;

  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => yMin + (finalRange * i) / yTickCount);

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">{label}</CardTitle>
            <p className="text-lg font-bold mt-0.5">{formatMetricValue(latestValue, type)}</p>
          </div>
          {pctChange !== 0 && (
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 ${isPositive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}
            >
              {pctChange >= 0 ? "+" : ""}{pctChange.toFixed(1).replace(".", ",")}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          {yTicks.map((v, i) => {
            const y = PAD.top + (1 - (v - yMin) / finalRange) * chartH;
            return (
              <g key={i}>
                <line x1={PAD.left} y1={y} x2={VW - PAD.right} y2={y} stroke="currentColor" opacity={0.1} strokeDasharray="4 4" />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
                  {formatMetricValue(v, type, true)}
                </text>
              </g>
            );
          })}
          <path d={areaPath} fill={lineColor} opacity={0.08} />
          <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} />

          {/* Data points with hover + click */}
          {coords.map((c, i) => {
            const dp = dataPoints[i];
            const isLast = i === coords.length - 1;
            const isHovered = hoveredIndex === i;
            const hasReport = !!dp.sourceReportId;

            return (
              <g key={i}>
                {/* Invisible larger hit area */}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={16}
                  fill="transparent"
                  className={hasReport ? "cursor-pointer" : ""}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => {
                    if (hasReport && onPointClick) onPointClick(dp.sourceReportId!);
                  }}
                />
                {/* Visible dot */}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isHovered ? 6 : isLast ? 5 : 4}
                  fill={isHovered || isLast ? lineColor : "white"}
                  stroke={lineColor}
                  strokeWidth={2}
                  className="pointer-events-none"
                />
              </g>
            );
          })}

          {/* Tooltip on hover */}
          {hoveredIndex !== null && (() => {
            const dp = dataPoints[hoveredIndex];
            const c = coords[hoveredIndex];
            const tooltipText = `${formatMetricValue(dp.value, type, true)} — ${dp.period}`;
            const rectW = Math.max(160, tooltipText.length * 6.5);
            const rectH = 28;
            const above = c.y - rectH - 12;
            const tooltipY = above < 10 ? c.y + 14 : above;
            const isBelow = above < 10;
            const tooltipX = Math.max(2, Math.min(c.x - rectW / 2, VW - rectW - 2));

            return (
              <g className="pointer-events-none">
                <rect
                  x={tooltipX}
                  y={tooltipY}
                  width={rectW}
                  height={rectH}
                  rx={4}
                  className="fill-popover stroke-border"
                  strokeWidth={1}
                />
                {isBelow ? (
                  <polygon
                    points={`${c.x - 5},${tooltipY} ${c.x + 5},${tooltipY} ${c.x},${tooltipY - 6}`}
                    className="fill-popover"
                  />
                ) : (
                  <polygon
                    points={`${c.x - 5},${tooltipY + rectH} ${c.x + 5},${tooltipY + rectH} ${c.x},${tooltipY + rectH + 6}`}
                    className="fill-popover"
                  />
                )}
                <text
                  x={tooltipX + rectW / 2}
                  y={tooltipY + 18}
                  textAnchor="middle"
                  className="fill-foreground text-[11px] font-semibold"
                >
                  {tooltipText}
                </text>
              </g>
            );
          })()}

          {/* Default last-point label (hidden when tooltip is showing for that point) */}
          {hoveredIndex !== coords.length - 1 && (
            <text
              x={coords[coords.length - 1].x}
              y={coords[coords.length - 1].y - 10}
              textAnchor="middle"
              className="fill-foreground text-[11px] font-semibold"
            >
              {formatMetricValue(last, type)}
            </text>
          )}

          {/* X-axis labels */}
          {dataPoints.map((d, i) => {
            const showAll = dataPoints.length <= 4;
            if (!showAll && i % 2 !== 0 && i !== dataPoints.length - 1) return null;
            const lbl = d.period.length > 12 ? d.period.slice(0, 12) : d.period;
            const labelY = PAD.top + chartH + 16;
            return (
              <text
                key={i}
                x={coords[i].x}
                y={labelY}
                textAnchor={dataPoints.length > 4 ? "end" : "middle"}
                className="fill-muted-foreground text-[10px]"
                transform={dataPoints.length > 4 ? `rotate(-30, ${coords[i].x}, ${labelY})` : undefined}
              >
                {lbl}
              </text>
            );
          })}
        </svg>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

interface CompanyMetricsTabProps {
  companyId: string;
  displayedMetricsFavorites?: string[];
}

export function CompanyMetricsTab({ companyId, displayedMetricsFavorites = [] }: CompanyMetricsTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { metrics: rawMetrics, isLoading } = usePortfolioCompanyMetrics(companyId);

  const allSeries = useMemo(() => buildSeriesFromMetrics(rawMetrics), [rawMetrics]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set(displayedMetricsFavorites));
  const [openReportId, setOpenReportId] = useState<string | null>(null);

  // Sync favorites from props
  useEffect(() => {
    setFavorites(new Set(displayedMetricsFavorites));
  }, [displayedMetricsFavorites]);

  // Auto-select: favorites first, then top 3 by data points + priority
  useEffect(() => {
    if (allSeries.length === 0 || selected.size > 0) return;
    if (displayedMetricsFavorites.length > 0) {
      setSelected(new Set(displayedMetricsFavorites));
      return;
    }
    const sorted = [...allSeries].sort((a, b) => {
      if (b.dataPoints.length !== a.dataPoints.length) return b.dataPoints.length - a.dataPoints.length;
      const idxA = PRIORITY_KEYS.indexOf(a.canonicalKey);
      const idxB = PRIORITY_KEYS.indexOf(b.canonicalKey);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
    setSelected(new Set(sorted.slice(0, 3).map((s) => s.canonicalKey)));
  }, [allSeries]);

  // Persist favorites mutation
  const favoriteMutation = useMutation({
    mutationFn: async (newFavorites: string[]) => {
      const { error } = await supabase
        .from("portfolio_companies")
        .update({ displayed_metrics: newFavorites })
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio-company", companyId] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-company-with-report", companyId] });
    },
  });

  const toggleFavorite = useCallback((canonicalKey: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(canonicalKey) ? next.delete(canonicalKey) : next.add(canonicalKey);
      favoriteMutation.mutate([...next]);
      return next;
    });
  }, [favoriteMutation]);

  // Group by category
  const categories = useMemo(() => {
    const cats = new Map<string, MetricSeries[]>();
    for (const s of allSeries) {
      const catKey = s.category;
      if (!cats.has(catKey)) cats.set(catKey, []);
      cats.get(catKey)!.push(s);
    }
    for (const [, list] of cats) {
      list.sort((a, b) => {
        const pa = PRIORITY_KEYS.indexOf(a.canonicalKey);
        const pb = PRIORITY_KEYS.indexOf(b.canonicalKey);
        const ia = pa === -1 ? 999 : pa;
        const ib = pb === -1 ? 999 : pb;
        if (ia !== ib) return ia - ib;
        return a.label.localeCompare(b.label);
      });
    }
    return cats;
  }, [allSeries]);

  const orderedCategories = useMemo(() => {
    return CATEGORY_ORDER
      .filter((key) => categories.has(key))
      .map((key) => ({ key, label: CATEGORY_LABELS[key] || key, series: categories.get(key)! }));
  }, [categories]);

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const selectAll = () => setSelected(new Set(allSeries.map((s) => s.canonicalKey)));
  const selectNone = () => setSelected(new Set());

  const selectedSeries = useMemo(
    () => allSeries.filter((s) => selected.has(s.canonicalKey)),
    [allSeries, selected],
  );

  const handlePointClick = useCallback((reportId: string) => {
    setOpenReportId(reportId);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <BarChart3 className="h-5 w-5 animate-pulse" />
        {t('companyDetail.metrics.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {allSeries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <BarChart3 className="h-8 w-8" />
          <p className="text-sm">{t('companyDetail.metrics.noMetrics')}</p>
        </div>
      ) : (
        <ResizablePanelGroup direction="horizontal" className="min-h-[400px] rounded-lg border">
          {/* Sidebar */}
          <ResizablePanel defaultSize={20} minSize={15} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('companyDetail.metrics.title')}
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                  {allSeries.length}
                </Badge>
              </span>
              <div className="flex gap-1">
                <button onClick={selectAll} className="text-[11px] text-primary hover:underline">{t('companyDetail.metrics.allSelect')}</button>
                <span className="text-muted-foreground text-[11px]">/</span>
                <button onClick={selectNone} className="text-[11px] text-primary hover:underline">{t('companyDetail.metrics.noneSelect')}</button>
              </div>
            </div>

            <div className="space-y-1 overflow-y-auto max-h-[60vh]">
              {orderedCategories.map(({ key: catKey, label: catLabel, series: catSeries }) => (
                <Collapsible key={catKey} defaultOpen={catKey !== "other"}>
                  <CollapsibleTrigger className="flex items-center gap-1 w-full py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground">
                    <ChevronDown className="h-3 w-3 transition-transform [[data-state=closed]_&]:-rotate-90" />
                    {catLabel}
                    <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                      {catSeries.length}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 ml-1">
                    {catSeries.map((m) => (
                      <label
                        key={m.canonicalKey}
                        className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selected.has(m.canonicalKey)}
                          onCheckedChange={() => toggle(m.canonicalKey)}
                          className="h-3.5 w-3.5"
                        />
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(m.canonicalKey); }}
                          className="shrink-0"
                          title="Favori"
                        >
                          <Star
                            className={`h-3.5 w-3.5 transition-colors ${favorites.has(m.canonicalKey) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-400"}`}
                          />
                        </button>
                        <span className="text-sm truncate flex-1">{m.label}</span>
                        <span className="text-[10px] ml-auto whitespace-nowrap text-muted-foreground">
                          {m.dataPoints.length} pt{m.dataPoints.length > 1 ? "s" : ""}
                        </span>
                      </label>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Main area */}
          <ResizablePanel defaultSize={80} className="p-4">
            {selected.size === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <BarChart3 className="h-12 w-12 opacity-30" />
                <p className="text-sm">{t('companyDetail.metrics.selectMetrics')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {selectedSeries.map((s) => (
                  <MetricChart key={s.canonicalKey} series={s} onPointClick={handlePointClick} />
                ))}
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      <ReportDetailSheet
        open={!!openReportId}
        onOpenChange={(open) => { if (!open) setOpenReportId(null); }}
        reportId={openReportId}
      />
    </div>
  );
}
