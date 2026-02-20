import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BarChart3, Sparkles, TrendingUp, TrendingDown, ChevronDown, RefreshCw, AlertTriangle, Info } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface AgentInsight {
  metric_key: string;
  label: string;
  current_value: string;
  trend: string;
  trend_direction: "up" | "down" | "stable";
  insight: string;
}

interface BPComparison {
  metric_key: string;
  label: string;
  bp_value: string;
  actual_value: string;
  deviation_pct: number;
  status: "on_track" | "behind" | "ahead";
  comment: string;
}

interface Alert {
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  metric_key?: string;
}

interface RecommendedMetric {
  metric_key: string;
  label: string;
  reason: string;
}

interface CompanyAnalysis {
  executive_summary: string;
  health_score: { score: number; label: string };
  top_insights: AgentInsight[];
  bp_vs_reality: BPComparison[];
  alerts: Alert[];
  recommended_metrics: RecommendedMetric[];
  key_questions: string[];
}

interface MetricDataPoint {
  period: string;
  date: string;
  value: number;
}

interface MetricSeries {
  key: string;
  label: string;
  type: "currency" | "percentage" | "number";
  dataPoints: MetricDataPoint[];
  latestValue: number;
  category: string;
}

interface Report {
  id: string;
  report_period: string | null;
  report_date: string | null;
  metrics: Record<string, any> | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const SPECIAL_LABELS: Record<string, string> = {
  mrr: "MRR", arr: "ARR", aum: "AuM", ebitda: "EBITDA",
  gmv: "GMV", nrr: "NRR",
};

function formatMetricLabel(key: string): string {
  if (SPECIAL_LABELS[key]) return SPECIAL_LABELS[key];
  let f = key.replace(/_/g, " ");
  if (f.includes("growth yoy")) f = f.replace(" growth yoy", " (YoY)");
  if (f.includes("growth mom")) f = f.replace(" growth mom", " (MoM)");
  f = f.replace(/\byoy\b/gi, "YoY").replace(/\bmom\b/gi, "MoM")
    .replace(/\bmrr\b/gi, "MRR").replace(/\barr\b/gi, "ARR")
    .replace(/\bebitda\b/gi, "EBITDA").replace(/\baum\b/gi, "AuM")
    .replace(/\bgmv\b/gi, "GMV").replace(/\bnrr\b/gi, "NRR");
  return f.split(" ").map(w => {
    if (/^[A-Z]{2,}$/.test(w) || /^\(.*\)$/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ");
}

function formatMetricValue(value: number, type: string): string {
  if (type === "currency") {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1_000_000_000) return `${sign}${(abs / 1e9).toFixed(1).replace(".", ",")}Md €`;
    if (abs >= 1_000_000) return `${sign}${(abs / 1e6).toFixed(1).replace(".", ",")}M €`;
    if (abs >= 1_000) return `${sign}${Math.round(abs / 1e3)}k €`;
    return `${sign}${Math.round(abs)} €`;
  }
  if (type === "percentage") {
    if (Math.abs(value) <= 1) return `${(value * 100).toFixed(1).replace(".", ",")}%`;
    if (Math.abs(value) < 100) return `${value.toFixed(1).replace(".", ",")}%`;
    return formatMetricValue(value, "currency");
  }
  return new Intl.NumberFormat("fr-FR").format(Math.round(value));
}

const PERCENTAGE_KEYS = /rate|margin|churn|growth|percentage|nrr/i;
const CURRENCY_KEYS = /revenue|mrr|arr|cash|ebitda|burn|cost|salary|debt|valuation|aum|inflow|outflow|gmv/i;

function detectMetricType(key: string, value: number): "currency" | "percentage" | "number" {
  if (PERCENTAGE_KEYS.test(key)) return "percentage";
  if (Math.abs(value) > 1000 || CURRENCY_KEYS.test(key)) return "currency";
  return "number";
}

function detectMetricCategory(key: string): string {
  if (/^(revenue|mrr|arr|gmv)$/i.test(key)) return "Revenu";
  if (/cash|burn|runway|debt/i.test(key)) return "Trésorerie";
  if (/ebitda|margin|outflow_rate|churn|nrr/i.test(key)) return "Performance";
  if (/growth|new_customer|new_contract|new_registered|new_project/i.test(key)) return "Croissance";
  if (/customer|active_user|registered_user|contract|user/i.test(key)) return "Clients";
  return "Autre";
}

const PRIORITY_KEYS = [
  "mrr", "revenue", "arr", "cash_position", "ebitda",
  "runway_months", "burn_rate", "gross_margin", "churn_rate", "employees",
];

function buildMetricSeries(reports: Report[]): MetricSeries[] {
  const map = new Map<string, MetricDataPoint[]>();

  for (const r of reports) {
    if (!r.metrics || !r.report_date) continue;
    for (const [key, raw] of Object.entries(r.metrics)) {
      const val = typeof raw === "number" ? raw : parseFloat(String(raw));
      if (isNaN(val)) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({
        period: r.report_period || r.report_date,
        date: r.report_date,
        value: val,
      });
    }
  }

  const series: MetricSeries[] = [];
  for (const [key, points] of map) {
    const isPriority = PRIORITY_KEYS.includes(key);
    if (points.length < 2 && !isPriority) continue;
    points.sort((a, b) => a.date.localeCompare(b.date));
    const latestValue = points[points.length - 1].value;
    series.push({
      key,
      label: formatMetricLabel(key),
      type: detectMetricType(key, latestValue),
      dataPoints: points,
      latestValue,
      category: detectMetricCategory(key),
    });
  }
  return series;
}

/* ------------------------------------------------------------------ */
/* Inverse metrics (up is bad)                                         */
/* ------------------------------------------------------------------ */

const INVERSE_METRICS = /burn_rate|churn_rate|outflow_rate/i;

/* ------------------------------------------------------------------ */
/* MetricChart                                                         */
/* ------------------------------------------------------------------ */

function MetricChart({ series }: { series: MetricSeries }) {
  const { dataPoints, type, key, label, latestValue } = series;

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

  // Variation badge
  const prev = dataPoints[dataPoints.length - 2].value;
  const last = dataPoints[dataPoints.length - 1].value;
  const pctChange = prev !== 0 ? ((last - prev) / Math.abs(prev)) * 100 : 0;
  const isInverse = INVERSE_METRICS.test(key);
  const isPositive = isInverse ? pctChange <= 0 : pctChange >= 0;

  // SVG chart
  const VW = 500, VH = 200;
  const PAD = { top: 20, right: 30, bottom: 40, left: 60 };
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

  // Y-axis ticks
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
          {/* Grid lines */}
          {yTicks.map((v, i) => {
            const y = PAD.top + (1 - (v - yMin) / finalRange) * chartH;
            return (
              <g key={i}>
                <line x1={PAD.left} y1={y} x2={VW - PAD.right} y2={y} stroke="currentColor" opacity={0.1} strokeDasharray="4 4" />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
                  {formatMetricValue(v, type)}
                </text>
              </g>
            );
          })}
          {/* Area */}
          <path d={areaPath} fill={lineColor} opacity={0.08} />
          {/* Line */}
          <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} />
          {/* Points */}
          {coords.map((c, i) => (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={i === coords.length - 1 ? 5 : 4}
              fill={i === coords.length - 1 ? lineColor : "white"}
              stroke={lineColor}
              strokeWidth={2}
            />
          ))}
          {/* Last value label */}
          <text
            x={coords[coords.length - 1].x}
            y={coords[coords.length - 1].y - 10}
            textAnchor="middle"
            className="fill-foreground text-[11px] font-semibold"
          >
            {formatMetricValue(last, type)}
          </text>
          {/* X labels */}
          {dataPoints.map((d, i) => {
            const showAll = dataPoints.length <= 4;
            if (!showAll && i % 2 !== 0 && i !== dataPoints.length - 1) return null;
            const lbl = d.period.length > 8 ? d.period.slice(0, 8) : d.period;
            return (
              <text
                key={i}
                x={coords[i].x}
                y={VH - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
                transform={dataPoints.length > 4 ? `rotate(-30, ${coords[i].x}, ${VH - 6})` : undefined}
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
/* Health Score Badge                                                   */
/* ------------------------------------------------------------------ */

function HealthScoreBadge({ score }: { score: number }) {
  const color =
    score <= 3 ? "bg-red-500" :
    score <= 5 ? "bg-amber-500" :
    score <= 7 ? "bg-emerald-500" :
    "bg-blue-500";

  return (
    <div className={`flex-shrink-0 w-12 h-12 rounded-full ${color} flex items-center justify-center`}>
      <span className="text-white text-lg font-bold">{score}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AI Insight Banner                                                    */
/* ------------------------------------------------------------------ */

function InsightBanner({
  analysis,
  loading,
  onRefresh,
  refreshing,
}: {
  analysis: CompanyAnalysis | null;
  loading: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-4 mb-6">
        {/* Health score skeleton */}
        <div className="flex items-start gap-4">
          <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
        {/* KPI cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2 pt-4 px-4">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-muted/30 border border-dashed rounded-lg p-6 mb-6 flex flex-col items-center gap-2">
        <Sparkles className="h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground text-center">
          L'analyse IA sera bientôt disponible pour cette entreprise
        </p>
      </div>
    );
  }

  const alertVariant = (severity: Alert["severity"]) => {
    if (severity === "critical") return "destructive" as const;
    return "outline" as const;
  };

  const alertColors = (severity: Alert["severity"]) => {
    if (severity === "critical") return "";
    if (severity === "warning") return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
    return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
  };

  return (
    <div className="space-y-4 mb-6 relative">
      {/* Refresh button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-0 right-0 h-8 w-8"
        onClick={onRefresh}
        disabled={refreshing}
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
      </Button>

      {/* Row 1: Health Score + Executive Summary */}
      <div className="flex items-start gap-4 pr-10">
        {analysis.health_score && <HealthScoreBadge score={analysis.health_score.score} />}
        <div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {analysis.health_score?.label}
          </span>
          <p className="text-sm text-muted-foreground mt-1">
            {analysis.executive_summary}
          </p>
        </div>
      </div>

      {/* Row 2: Top 3 KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {analysis.top_insights?.map((ins) => {
          const colors =
            ins.trend_direction === "up"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
              : ins.trend_direction === "down"
                ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                : "bg-muted text-muted-foreground border-border";
          const Icon = ins.trend_direction === "down" ? TrendingDown : TrendingUp;
          return (
            <Card key={ins.metric_key}>
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{ins.label}</span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${colors}`}>
                    <Icon className="h-3 w-3 mr-0.5" />
                    {ins.trend}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold">{ins.current_value}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-2">
                  {ins.insight}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Row 3: Alerts */}
      {analysis.alerts && analysis.alerts.length > 0 && (
        <TooltipProvider>
          <div className="flex flex-wrap gap-2">
            {analysis.alerts.map((alert, i) => (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div>
                    <Badge
                      variant={alertVariant(alert.severity)}
                      className={`text-xs cursor-default ${alertColors(alert.severity)}`}
                    >
                      {alert.severity === "critical" ? (
                        <AlertTriangle className="h-3 w-3 mr-1" />
                      ) : alert.severity === "warning" ? (
                        <AlertTriangle className="h-3 w-3 mr-1" />
                      ) : (
                        <Info className="h-3 w-3 mr-1" />
                      )}
                      {alert.title}
                    </Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-sm">{alert.message}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

interface CompanyMetricsTabProps {
  companyId: string;
}

export function CompanyMetricsTab({ companyId }: CompanyMetricsTabProps) {
  const queryClient = useQueryClient();

  // AI analysis via edge function
  const {
    data: analysis = null,
    isLoading: analysisLoading,
    isFetching: analysisRefreshing,
  } = useQuery<CompanyAnalysis | null>({
    queryKey: ["company-intelligence", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("company-intelligence", {
        body: { company_id: companyId, mode: "analysis" },
      });
      if (error) {
        console.warn("Company intelligence not available:", error.message);
        return null;
      }
      return data as CompanyAnalysis;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const handleRefresh = useCallback(() => {
    queryClient.fetchQuery({
      queryKey: ["company-intelligence", companyId],
      queryFn: async () => {
        const { data, error } = await supabase.functions.invoke("company-intelligence", {
          body: { company_id: companyId, mode: "analysis", force_refresh: true },
        });
        if (error) {
          console.warn("Company intelligence refresh failed:", error.message);
          return null;
        }
        return data as CompanyAnalysis;
      },
    });
  }, [companyId, queryClient]);

  // Fetch reports with metrics
  const { data: allSeries = [], isLoading } = useQuery({
    queryKey: ["company-metrics-from-reports", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_reports")
        .select("id, report_period, report_date, metrics")
        .eq("company_id", companyId)
        .eq("processing_status", "completed")
        .not("metrics", "is", null)
        .order("report_date", { ascending: true });

      if (error) throw error;
      return buildMetricSeries((data ?? []) as Report[]);
    },
    enabled: !!companyId,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Auto-select top 3
  useEffect(() => {
    if (allSeries.length === 0 || selected.size > 0) return;
    const sorted = [...allSeries].sort((a, b) => {
      if (b.dataPoints.length !== a.dataPoints.length) return b.dataPoints.length - a.dataPoints.length;
      const idxA = PRIORITY_KEYS.indexOf(a.key);
      const idxB = PRIORITY_KEYS.indexOf(b.key);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
    setSelected(new Set(sorted.slice(0, 3).map((s) => s.key)));
  }, [allSeries]);

  // Group by category
  const categories = useMemo(() => {
    const cats = new Map<string, MetricSeries[]>();
    for (const s of allSeries) {
      if (!cats.has(s.category)) cats.set(s.category, []);
      cats.get(s.category)!.push(s);
    }
    return cats;
  }, [allSeries]);

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const selectAll = () => setSelected(new Set(allSeries.map((s) => s.key)));
  const selectNone = () => setSelected(new Set());

  const selectedSeries = useMemo(
    () => allSeries.filter((s) => selected.has(s.key)),
    [allSeries, selected],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <BarChart3 className="h-5 w-5 animate-pulse" />
        Chargement des métriques…
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* ZONE 1 — AI Banner */}
      <InsightBanner analysis={analysis} loading={analysisLoading} onRefresh={handleRefresh} refreshing={analysisRefreshing} />

      {/* ZONE 2 — Metrics from reports */}
      {allSeries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <BarChart3 className="h-8 w-8" />
          <p className="text-sm">Aucune métrique disponible</p>
        </div>
      ) : (
        <ResizablePanelGroup direction="horizontal" className="min-h-[400px] rounded-lg border">
          {/* Sidebar */}
          <ResizablePanel defaultSize={20} minSize={15} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Métriques
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                  {allSeries.length}
                </Badge>
              </span>
              <div className="flex gap-1">
                <button onClick={selectAll} className="text-[11px] text-primary hover:underline">Tout</button>
                <span className="text-muted-foreground text-[11px]">/</span>
                <button onClick={selectNone} className="text-[11px] text-primary hover:underline">Aucun</button>
              </div>
            </div>

            <div className="space-y-1 overflow-y-auto max-h-[60vh]">
              {[...categories.entries()].map(([cat, metrics]) => (
                <Collapsible key={cat} defaultOpen>
                  <CollapsibleTrigger className="flex items-center gap-1 w-full py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground">
                    <ChevronDown className="h-3 w-3 transition-transform [[data-state=closed]_&]:-rotate-90" />
                    {cat}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 ml-1">
                    {metrics.map((m) => (
                      <label
                        key={m.key}
                        className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selected.has(m.key)}
                          onCheckedChange={() => toggle(m.key)}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-sm truncate flex-1">{m.label}</span>
                        <span className={`text-[10px] ml-auto whitespace-nowrap ${m.dataPoints.length >= 2 ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
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
                <p className="text-sm">Sélectionnez des métriques dans le panneau de gauche</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {selectedSeries.map((s) => (
                  <MetricChart key={s.key} series={s} />
                ))}
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
}
