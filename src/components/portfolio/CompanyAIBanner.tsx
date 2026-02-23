import { useState } from "react";
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
  Sparkles,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompanyAIAnalysis, type CompanyAnalysis, type TopInsight } from "@/hooks/useCompanyAIAnalysis";

// ── ScoreRing ──────────────────────────────────────────

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;
  const color =
    score >= 8 ? "#22c55e" : score >= 6 ? "#10b981" : score >= 4 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/20" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={circumference - progress} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-base font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ── TrendIcon ──────────────────────────────────────────

function TrendIcon({ direction }: { direction: string }) {
  if (direction === "up") return <TrendingUp className="h-3 w-3" />;
  if (direction === "down") return <TrendingDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
}

// ── Exported sub-components for use in overview layout ──

export { ScoreRing, TrendIcon };

// ── Helper functions ──

export const cardBg = (dir: string) =>
  dir === "up"
    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900"
    : dir === "down"
      ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900"
      : "bg-zinc-50 border-zinc-200 dark:bg-zinc-900/30 dark:border-zinc-800";

export const badgeClasses = (dir: string) =>
  dir === "up"
    ? "text-emerald-700 bg-emerald-100 border-emerald-300 dark:text-emerald-400 dark:bg-emerald-900/40 dark:border-emerald-800"
    : dir === "down"
      ? "text-red-700 bg-red-100 border-red-300 dark:text-red-400 dark:bg-red-900/40 dark:border-red-800"
      : "text-zinc-600 bg-zinc-100 border-zinc-300 dark:text-zinc-400 dark:bg-zinc-800 dark:border-zinc-700";

// ── Main Component ─────────────────────────────────────

interface CompanyAIBannerProps {
  companyId: string;
}

export function CompanyAIBanner({ companyId }: CompanyAIBannerProps) {
  const { analysis, loading, analyzing, handleRunAnalysis } = useCompanyAIAnalysis(companyId);
  const [expanded, setExpanded] = useState(false);

  // ── Loading ──
  if (loading) {
    return (
      <div className="mb-6">
        <div className="rounded-2xl border bg-card p-4 flex items-start gap-4">
          <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  // ── Analyzing ──
  if (analyzing) {
    return (
      <div className="mb-6">
        <div className="rounded-2xl border bg-card p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center bg-primary/10 flex-shrink-0">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Analyse en cours…</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              L'agent croise reports, métriques et deck (~2 min)
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty ──
  if (!analysis) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/20 border border-dashed mb-6">
        <Sparkles className="h-5 w-5 text-muted-foreground/40 flex-shrink-0" />
        <p className="text-sm text-muted-foreground flex-1">
          Aucune analyse IA disponible pour cette company.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRunAnalysis(false)}
          className="flex-shrink-0 gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Analyser
        </Button>
      </div>
    );
  }

  // ── Helpers ──
  const summary = analysis.executive_summary || "";
  const truncated = summary.length > 180;
  const displaySummary = expanded || !truncated ? summary : summary.slice(0, 180) + "…";

  const visibleInsights = (analysis.top_insights || []).filter(
    (ins) => ins.current_value && ins.current_value !== "-"
  );

  const goodPoints = analysis.health_score?.good_points;
  const badPoints = analysis.health_score?.bad_points;
  const hasPointsRow = (goodPoints && goodPoints.length > 0) || (badPoints && badPoints.length > 0);

  return (
    <div className="space-y-3 mb-6">
      {/* Row 1 — Score + Verdict */}
      <div className="rounded-2xl border bg-card p-4 flex items-start gap-4">
        {analysis.health_score && <ScoreRing score={analysis.health_score.score} />}
        <div className="flex-1 min-w-0">
          {analysis.health_score?.label && (
            <p className="text-sm font-semibold">{analysis.health_score.label}</p>
          )}
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            {displaySummary}
            {truncated && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="ml-1 text-primary text-[11px] font-medium hover:underline"
              >
                {expanded ? "Moins" : "Lire plus"}
              </button>
            )}
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0 h-8 w-8"
                onClick={() => handleRunAnalysis(true)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Relancer (~2 min)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Row 2 — 3 KPI Cards */}
      {visibleInsights.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {visibleInsights.map((ins, i) => (
            <div
              key={i}
              className={cn("rounded-xl border p-3", cardBg(ins.trend_direction))}
            >
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                {ins.label}
              </p>
              <p className="text-xl font-bold mt-0.5">{ins.current_value}</p>
              {ins.trend && (
                <span
                  className={cn(
                    "text-[11px] font-medium px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1 mt-1",
                    badgeClasses(ins.trend_direction)
                  )}
                >
                  <TrendIcon direction={ins.trend_direction} />
                  {ins.trend}
                </span>
              )}
              {ins.context && (
                <p className="text-[10px] text-muted-foreground mt-1">{ins.context}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Row 3 — Points forts / Points faibles */}
      {hasPointsRow && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-emerald-50/50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Points forts
              </span>
            </div>
            {goodPoints && goodPoints.length > 0 ? (
              <ul className="space-y-0.5">
                {goodPoints.map((pt, i) => (
                  <li key={i} className="flex items-baseline gap-2 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1" />
                    <span className="text-xs">{pt}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-muted-foreground">—</p>
            )}
          </div>

          <div className="rounded-xl bg-red-50/50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/50 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">
                Points faibles
              </span>
            </div>
            {badPoints && badPoints.length > 0 ? (
              <ul className="space-y-0.5">
                {badPoints.map((pt, i) => (
                  <li key={i} className="flex items-baseline gap-2 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1" />
                    <span className="text-xs">{pt}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-muted-foreground">—</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
