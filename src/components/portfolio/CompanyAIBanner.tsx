import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Info,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────

interface AgentInsight {
  metric_key: string;
  label: string;
  current_value: string;
  trend: string;
  trend_direction: "up" | "down" | "stable";
  insight: string;
}

interface Alert {
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  metric_key: string | null;
}

interface CompanyAnalysis {
  executive_summary: string;
  health_score: {
    score: number;
    label: string;
    rationale: string;
  };
  top_insights: AgentInsight[];
  alerts: Alert[];
  bp_vs_reality: any[];
  recommended_metrics: any[];
  key_questions: string[];
  raw_markdown?: string;
}

// ── Health Score Badge ─────────────────────────────────

function HealthScoreBadge({ score }: { score: number }) {
  const config =
    score <= 3
      ? { bg: "bg-red-500", label: "Critique" }
      : score <= 5
        ? { bg: "bg-amber-500", label: "Sous surveillance" }
        : score <= 7
          ? { bg: "bg-emerald-500", label: "En bonne voie" }
          : { bg: "bg-blue-500", label: "Excellent" };

  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <div
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white",
          config.bg
        )}
      >
        {score}
      </div>
      <span className="text-[10px] font-medium text-center mt-1 text-muted-foreground">
        {config.label}
      </span>
    </div>
  );
}

// ── Trend Icon helper ──────────────────────────────────

function TrendIcon({ direction }: { direction: string }) {
  if (direction === "up") return <TrendingUp className="h-2.5 w-2.5" />;
  if (direction === "down") return <TrendingDown className="h-2.5 w-2.5" />;
  return <Minus className="h-2.5 w-2.5" />;
}

// ── Main Component ─────────────────────────────────────

interface CompanyAIBannerProps {
  companyId: string;
}

export function CompanyAIBanner({ companyId }: CompanyAIBannerProps) {
  const [analysis, setAnalysis] = useState<CompanyAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalysis = useCallback(
    async (forceRefresh = false) => {
      try {
        const { data } = await supabase.functions.invoke(
          "company-intelligence",
          {
            body: {
              company_id: companyId,
              mode: "analysis",
              ...(forceRefresh ? { force_refresh: true } : {}),
            },
          }
        );
        if (data?.success && data?.analysis) {
          setAnalysis(data.analysis);
        }
      } catch (err) {
        console.error("AI analysis fetch failed:", err);
      }
    },
    [companyId]
  );

  useEffect(() => {
    setLoading(true);
    fetchAnalysis().finally(() => setLoading(false));
  }, [fetchAnalysis]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalysis(true);
    setRefreshing(false);
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="space-y-4 mb-6">
        <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 border">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Skeleton className="h-[130px] rounded-xl" />
          <Skeleton className="h-[130px] rounded-xl" />
          <Skeleton className="h-[130px] rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (!analysis) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/20 border border-dashed mb-6">
        <Sparkles className="h-5 w-5 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          L'analyse IA sera disponible lorsque des reports auront été traités.
        </p>
      </div>
    );
  }

  // ── Trend color helpers ──
  const cardBg = (dir: string) =>
    dir === "up"
      ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900"
      : dir === "down"
        ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900"
        : "bg-zinc-50 border-zinc-200 dark:bg-zinc-900/30 dark:border-zinc-800";

  const badgeClasses = (dir: string) =>
    dir === "up"
      ? "text-emerald-700 bg-emerald-100 border-emerald-300 dark:text-emerald-400 dark:bg-emerald-900/40 dark:border-emerald-800"
      : dir === "down"
        ? "text-red-700 bg-red-100 border-red-300 dark:text-red-400 dark:bg-red-900/40 dark:border-red-800"
        : "text-zinc-600 bg-zinc-100 border-zinc-300 dark:text-zinc-400 dark:bg-zinc-800 dark:border-zinc-700";

  return (
    <div className="space-y-4 mb-6">
      {/* Row 1: Health Score + Executive Summary */}
      <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 border">
        {analysis.health_score && (
          <HealthScoreBadge score={analysis.health_score.score} />
        )}
        <div className="flex-1">
          {analysis.health_score?.label && (
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {analysis.health_score.label}
            </span>
          )}
          <p className="text-sm text-muted-foreground leading-relaxed mt-1">
            {analysis.executive_summary}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
          />
        </Button>
      </div>

      {/* Row 2: 3 KPI Cards */}
      {analysis.top_insights && analysis.top_insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {analysis.top_insights.map((ins, i) => (
            <div
              key={ins.metric_key || i}
              className={cn("rounded-xl p-4 border", cardBg(ins.trend_direction))}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {ins.label}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-medium px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1",
                    badgeClasses(ins.trend_direction)
                  )}
                >
                  <TrendIcon direction={ins.trend_direction} />
                  {ins.trend}
                </span>
              </div>
              <p className="text-2xl font-bold mt-1">{ins.current_value}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-2 line-clamp-2">
                {ins.insight}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Row 3: Alerts */}
      {analysis.alerts && analysis.alerts.length > 0 && (
        <TooltipProvider>
          <div className="flex flex-wrap gap-2">
            {analysis.alerts.map((alert, i) => {
              const alertIcon =
                alert.severity === "info" ? (
                  <Info className="h-3 w-3" />
                ) : (
                  <AlertTriangle className="h-3 w-3" />
                );

              const alertClasses =
                alert.severity === "critical"
                  ? "bg-destructive text-destructive-foreground"
                  : alert.severity === "warning"
                    ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
                    : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";

              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-1 rounded-full border inline-flex items-center gap-1 cursor-default",
                        alertClasses
                      )}
                    >
                      {alertIcon}
                      {alert.title}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-xs">{alert.message}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
