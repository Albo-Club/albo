import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TimeSeries } from "@/hooks/useCompanyDashboardMetrics";
import {
  getMetricLabel,
  formatYAxis,
  shortPeriod,
  formatMetricValue,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
} from "./metricLabels";

interface Props {
  series: TimeSeries[];
  companyId: string;
}

const CHART_COLORS = {
  actual: "hsl(var(--primary))",
  target: "#9CA3AF",
};

export function MetricsCharts({ series, companyId }: Props) {
  const categories = useMemo(() => {
    const cats = new Set(series.map((s) => s.category));
    return ["all", ...Array.from(cats)];
  }, [series]);

  const [activeCat, setActiveCat] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const chartRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const filtered = activeCat === "all" ? series : series.filter((s) => s.category === activeCat);
  const visible = showAll ? filtered : filtered.slice(0, 6);

  if (!series.length) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        Pas assez de données pour afficher des graphiques d'évolution (minimum 3 reports sur des périodes différentes)
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Évolution</h3>
        <div className="flex gap-1 flex-wrap">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCat === cat ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setActiveCat(cat);
                setShowAll(false);
              }}
            >
              {cat === "all" ? "Tous" : CATEGORY_LABELS[cat] || cat}
            </Button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Pas de données pour cette catégorie
        </div>
      ) : (
        <div
          className={`grid gap-4 ${
            visible.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
          }`}
        >
          {visible.map((ts) => (
            <div key={ts.key} ref={(el) => (chartRefs.current[ts.key] = el)} id={`chart-${ts.key}`}>
              <TimeSeriesChart ts={ts} companyId={companyId} />
            </div>
          ))}
        </div>
      )}

      {filtered.length > 6 && !showAll && (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
            Voir tout ({filtered.length})
          </Button>
        </div>
      )}
    </section>
  );
}

function TimeSeriesChart({ ts, companyId }: { ts: TimeSeries; companyId: string }) {
  const navigate = useNavigate();
  const hasTargets = ts.targets.length > 0;

  const metricType = useMemo(() => {
    // Infer from key
    if (ts.key.includes("margin") || ts.key.includes("pct") || ts.key === "churn_rate") return "percentage";
    if (ts.key === "runway_months") return "months";
    if (ts.key === "employees" || ts.key === "customers") return "number";
    return "currency";
  }, [ts.key]);

  const chartData = useMemo(() => {
    const targetMap = new Map(ts.targets.map((t) => [t.sort_date, parseFloat(t.value)]));

    return ts.data_points.map((dp) => ({
      sortDate: dp.sort_date,
      period: dp.period,
      label: shortPeriod(dp.period),
      actual: parseFloat(dp.value),
      target: targetMap.get(dp.sort_date) ?? undefined,
      source_report_id: dp.source_report_id,
    }));
  }, [ts]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3 text-xs space-y-1">
        <p className="font-medium">{d?.period}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.dataKey === "actual" ? "Réalisé" : "Objectif"} :{" "}
            {formatMetricValue(String(p.value), metricType)}
          </p>
        ))}
        {d?.source_report_id && (
          <button
            className="text-primary hover:underline mt-1 block"
            onClick={() => navigate(`/portfolio/${companyId}/reports/${d.source_report_id}`)}
          >
            Voir le report →
          </button>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">{getMetricLabel(ts.key)}</CardTitle>
          <Badge variant="outline" className={`text-[10px] py-0 px-1 ${CATEGORY_COLORS[ts.category] || ""}`}>
            {CATEGORY_LABELS[ts.category] || ts.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatYAxis(v, metricType)}
              width={55}
            />
            <RTooltip content={<CustomTooltip />} />

            {hasTargets && (
              <Legend
                formatter={(value: string) => (value === "actual" ? "Réalisé" : "Objectif")}
                wrapperStyle={{ fontSize: 11 }}
              />
            )}

            <Line
              type="monotone"
              dataKey="actual"
              stroke={CHART_COLORS.actual}
              strokeWidth={2}
              dot={{ r: 3, fill: CHART_COLORS.actual }}
              activeDot={{ r: 5 }}
              name="actual"
            />

            {hasTargets && (
              <Line
                type="monotone"
                dataKey="target"
                stroke={CHART_COLORS.target}
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                name="target"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function scrollToChart(key: string) {
  const el = document.getElementById(`chart-${key}`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}
