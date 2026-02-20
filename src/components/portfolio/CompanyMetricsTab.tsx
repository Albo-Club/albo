import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { BarChart3 } from "lucide-react";
import { formatMetricLabel, formatMetricValue } from "@/lib/portfolioFormatters";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface DataPoint {
  report_period: string;
  metric_value: string;
  created_at: string;
}

interface MetricGroup {
  metric_key: string;
  metric_type: string;
  points: DataPoint[];
}

const TYPE_CATEGORIES: Record<string, string> = {
  currency: "Financier",
  percentage: "Performance",
  number: "Chiffres",
  months: "Chiffres",
  text: "Autre",
};

const PRIORITY_KEYS = [
  "revenue",
  "arr",
  "mrr",
  "cash_position",
  "burn_rate",
  "runway_months",
  "ebitda",
  "gross_margin",
  "churn_rate",
  "employees",
];

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

function useCompanyMetricsGrouped(companyId: string) {
  return useQuery({
    queryKey: ["company-metrics-grouped", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_company_metrics")
        .select("metric_key, metric_type, metric_value, report_period, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const map = new Map<string, MetricGroup>();
      for (const row of data ?? []) {
        if (!map.has(row.metric_key)) {
          map.set(row.metric_key, {
            metric_key: row.metric_key,
            metric_type: row.metric_type,
            points: [],
          });
        }
        map.get(row.metric_key)!.points.push({
          report_period: row.report_period ?? "",
          metric_value: row.metric_value,
          created_at: row.created_at,
        });
      }
      return Array.from(map.values());
    },
    enabled: !!companyId,
  });
}

/* ------------------------------------------------------------------ */
/* SVG mini-chart                                                      */
/* ------------------------------------------------------------------ */

function MiniLineChart({
  points,
  metricType,
  metricKey,
}: {
  points: DataPoint[];
  metricType: string;
  metricKey: string;
}) {
  const values = points.map((p) => parseFloat(p.metric_value)).filter((v) => !isNaN(v));
  if (values.length < 2) return null;

  const W = 320;
  const H = 160;
  const PX = 40;
  const PY = 24;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = values.map((v, i) => ({
    x: PX + (i / (values.length - 1)) * (W - PX * 2),
    y: PY + (1 - (v - min) / range) * (H - PY * 2),
  }));

  const trend = values[values.length - 1] >= values[0];
  const strokeColor = trend ? "hsl(var(--chart-2))" : "hsl(var(--destructive))";
  const fillColor = trend
    ? "hsl(var(--chart-2) / 0.1)"
    : "hsl(var(--destructive) / 0.1)";

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x},${H - PY} L${coords[0].x},${H - PY} Z`;

  // Y-axis ticks
  const yTicks = [min, min + range / 2, max];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* area */}
      <path d={areaPath} fill={fillColor} />
      {/* line */}
      <path d={linePath} fill="none" stroke={strokeColor} strokeWidth={2} />
      {/* points */}
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={3} fill={strokeColor} />
      ))}
      {/* last value label */}
      <text
        x={coords[coords.length - 1].x}
        y={coords[coords.length - 1].y - 8}
        textAnchor="middle"
        className="fill-foreground text-[9px] font-medium"
      >
        {formatMetricValue(points[points.length - 1].metric_value, metricType, metricKey)}
      </text>
      {/* Y axis */}
      {yTicks.map((v, i) => {
        const y = PY + (1 - (v - min) / range) * (H - PY * 2);
        return (
          <text
            key={i}
            x={PX - 4}
            y={y + 3}
            textAnchor="end"
            className="fill-muted-foreground text-[8px]"
          >
            {formatMetricValue(String(v), metricType, metricKey)}
          </text>
        );
      })}
      {/* X axis labels */}
      {points.map((p, i) => {
        if (points.length > 6 && i % 2 !== 0 && i !== points.length - 1) return null;
        return (
          <text
            key={i}
            x={coords[i].x}
            y={H - 4}
            textAnchor="middle"
            className="fill-muted-foreground text-[7px]"
          >
            {p.report_period.length > 8 ? p.report_period.slice(0, 8) : p.report_period}
          </text>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Variation badge                                                     */
/* ------------------------------------------------------------------ */

function VariationBadge({ points }: { points: DataPoint[] }) {
  if (points.length < 2) return null;
  const prev = parseFloat(points[points.length - 2].metric_value);
  const last = parseFloat(points[points.length - 1].metric_value);
  if (isNaN(prev) || isNaN(last) || prev === 0) return null;
  const pct = ((last - prev) / Math.abs(prev)) * 100;
  const positive = pct >= 0;
  return (
    <Badge
      variant="secondary"
      className={`text-[10px] px-1.5 py-0 ${positive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}
    >
      {positive ? "+" : ""}
      {pct.toFixed(1).replace(".", ",")}%
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

interface CompanyMetricsTabProps {
  companyId: string;
}

export function CompanyMetricsTab({ companyId }: CompanyMetricsTabProps) {
  const { data: groups = [], isLoading } = useCompanyMetricsGrouped(companyId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [topSlots, setTopSlots] = useState<string[]>([]);

  // Auto-select on mount
  useEffect(() => {
    if (groups.length === 0) return;
    if (selected.size > 0) return; // already initialised

    const sorted = [...groups].sort((a, b) => {
      if (b.points.length !== a.points.length) return b.points.length - a.points.length;
      const idxA = PRIORITY_KEYS.indexOf(a.metric_key);
      const idxB = PRIORITY_KEYS.indexOf(b.metric_key);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    const top3 = sorted.slice(0, 3).map((g) => g.metric_key);
    setSelected(new Set(top3));
    setTopSlots(top3);
  }, [groups]);

  // Group by category
  const categories = useMemo(() => {
    const cats = new Map<string, MetricGroup[]>();
    for (const g of groups) {
      const cat = TYPE_CATEGORIES[g.metric_type] || "Autre";
      if (!cats.has(cat)) cats.set(cat, []);
      cats.get(cat)!.push(g);
    }
    return cats;
  }, [groups]);

  const toggle = useCallback(
    (key: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
          setTopSlots((ts) => ts.filter((k) => k !== key));
        } else {
          next.add(key);
          setTopSlots((ts) => {
            if (ts.length < 3) return [...ts, key];
            return ts;
          });
        }
        return next;
      });
    },
    [],
  );

  const selectAll = () => {
    const all = groups.map((g) => g.metric_key);
    setSelected(new Set(all));
    setTopSlots((ts) => (ts.length > 0 ? ts : all.slice(0, 3)));
  };
  const selectNone = () => {
    setSelected(new Set());
    setTopSlots([]);
  };

  const promoteToTop = (key: string) => {
    setTopSlots((ts) => {
      const without = ts.filter((k) => k !== key);
      // replace last slot
      const newSlots = [...without.slice(0, 2), key];
      return newSlots;
    });
  };

  const groupMap = useMemo(() => {
    const m = new Map<string, MetricGroup>();
    groups.forEach((g) => m.set(g.metric_key, g));
    return m;
  }, [groups]);

  const topMetrics = topSlots.filter((k) => selected.has(k)).map((k) => groupMap.get(k)!).filter(Boolean);
  const extraMetrics = [...selected]
    .filter((k) => !topSlots.includes(k))
    .map((k) => groupMap.get(k)!)
    .filter(Boolean);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <BarChart3 className="h-5 w-5 animate-pulse" />
        Chargement des métriques…
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <BarChart3 className="h-8 w-8" />
        <p className="text-sm">Aucune métrique disponible</p>
      </div>
    );
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="min-h-[400px] rounded-lg border">
      {/* Sidebar */}
      <ResizablePanel defaultSize={25} minSize={20} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase text-muted-foreground font-medium tracking-wide">
            Métriques ({groups.length})
          </span>
          <div className="flex gap-1">
            <button onClick={selectAll} className="text-[11px] text-primary hover:underline">
              Tout
            </button>
            <span className="text-muted-foreground text-[11px]">/</span>
            <button onClick={selectNone} className="text-[11px] text-primary hover:underline">
              Aucun
            </button>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto max-h-[60vh]">
          {[...categories.entries()].map(([cat, metrics]) => (
            <div key={cat}>
              <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wider mb-1.5">
                {cat}
              </p>
              <div className="space-y-1">
                {metrics.map((m) => (
                  <label
                    key={m.metric_key}
                    className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer group"
                  >
                    <Checkbox
                      checked={selected.has(m.metric_key)}
                      onCheckedChange={() => toggle(m.metric_key)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-sm truncate flex-1">
                      {formatMetricLabel(m.metric_key)}
                    </span>
                    {m.points.length >= 2 && (
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {m.points.length} pts
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Main area */}
      <ResizablePanel defaultSize={75} className="p-4">
        {selected.size === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <BarChart3 className="h-10 w-10" />
            <p className="text-sm font-medium">Sélectionnez des métriques</p>
            <p className="text-xs">
              Cochez des métriques dans le panneau de gauche pour afficher les graphiques
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top charts */}
            {topMetrics.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {topMetrics.map((m) => (
                  <Card key={m.metric_key}>
                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">
                          {formatMetricLabel(m.metric_key)}
                        </CardTitle>
                        <VariationBadge points={m.points} />
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {m.points.length >= 2 ? (
                        <MiniLineChart
                          points={m.points}
                          metricType={m.metric_type}
                          metricKey={m.metric_key}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center py-4">
                          <span className="text-3xl font-bold">
                            {formatMetricValue(
                              m.points[0]?.metric_value,
                              m.metric_type,
                              m.metric_key,
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground mt-1">
                            {m.points[0]?.report_period}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Extra KPI cards */}
            {extraMetrics.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {extraMetrics.map((m) => (
                  <Card
                    key={m.metric_key}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => promoteToTop(m.metric_key)}
                  >
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground truncate">
                        {formatMetricLabel(m.metric_key)}
                      </p>
                      <p className="text-lg font-semibold mt-1">
                        {formatMetricValue(
                          m.points[m.points.length - 1]?.metric_value,
                          m.metric_type,
                          m.metric_key,
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.points[m.points.length - 1]?.report_period}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
