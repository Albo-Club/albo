import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertCircle,
  AlertTriangle,
  CircleCheck,
  ChevronDown,
  TrendingDown,
  Sparkles,
  RefreshCw,
  Loader2,
  MessageCircleQuestion,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────

interface Alert {
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  metric_key: string | null;
}

interface BPItem {
  metric: string;
  deck_projection: string;
  actual: string;
  verdict: string;
  comment: string;
}

interface KeyQuestion {
  question: string;
  context?: string;
  urgency?: string;
}

interface CompanyAnalysis {
  executive_summary: string;
  health_score: { score: number; label: string; rationale: string };
  top_insights: any[];
  alerts: Alert[];
  bp_vs_reality: BPItem[];
  recommended_metrics: any[];
  key_questions: (string | KeyQuestion)[];
  raw_markdown?: string;
}

// ── ScoreRing ──────────────────────────────────────────

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;
  const color =
    score >= 8 ? "#22c55e" : score >= 6 ? "#10b981" : score >= 4 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        className="text-muted/30"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="text-base font-bold fill-foreground"
      >
        {score}
      </text>
    </svg>
  );
}

// ── Alert Card ─────────────────────────────────────────

function AlertCard({ alert }: { alert: Alert }) {
  const [open, setOpen] = useState(false);

  const icon =
    alert.severity === "critical" ? (
      <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
    ) : alert.severity === "warning" ? (
      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
    ) : (
      <CircleCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
    );

  const bg =
    alert.severity === "critical"
      ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900"
      : alert.severity === "warning"
        ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900"
        : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900";

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={cn("rounded-xl border p-3 text-left w-full transition-colors", bg)}
    >
      <div className="flex gap-2">
        {icon}
        <span className="text-xs font-medium line-clamp-2">{alert.title}</span>
      </div>
      {open && (
        <p className="text-[11px] text-muted-foreground mt-2">{alert.message}</p>
      )}
    </button>
  );
}

// ── Main Component ─────────────────────────────────────

interface CompanyAIBannerProps {
  companyId: string;
}

export function CompanyAIBanner({ companyId }: CompanyAIBannerProps) {
  const [analysis, setAnalysis] = useState<CompanyAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadCachedAnalysis = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("portfolio_companies")
        .select("ai_analysis, ai_analysis_updated_at")
        .eq("id", companyId)
        .single();

      if (error) {
        console.error("Error loading cached analysis:", error);
        return;
      }

      const cachedAnalysis = data?.ai_analysis as unknown as CompanyAnalysis;
      if (cachedAnalysis?.health_score?.score > 0) {
        setAnalysis(cachedAnalysis);
      }
    } catch (err) {
      console.error("AI cache load failed:", err);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    loadCachedAnalysis().finally(() => setLoading(false));
  }, [loadCachedAnalysis]);

  const handleRunAnalysis = async (forceRefresh = false) => {
    setAnalyzing(true);
    try {
      const { data } = await supabase.functions.invoke("company-intelligence", {
        body: {
          company_id: companyId,
          mode: "analysis",
          force_refresh: forceRefresh,
        },
      });
      if (data?.success && data?.analysis) {
        setAnalysis(data.analysis);
      }
    } catch (err) {
      console.error("AI analysis failed:", err);
    } finally {
      setAnalyzing(false);
    }
  };

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
  const displaySummary =
    expanded || !truncated ? summary : summary.slice(0, 180) + "…";

  const sortedAlerts = [...(analysis.alerts || [])].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  const onTrackKeywords = ["dessus", "conforme", "excellent", "mieux", "on_track", "ahead", "on track"];
  const watchKeywords = ["retard", "behind", "insuffisant", "en-dessous", "en dessous", "below"];

  const bpOnTrack = (analysis.bp_vs_reality || []).filter((bp) =>
    onTrackKeywords.some((k) => bp.verdict?.toLowerCase().includes(k))
  );
  const bpWatch = (analysis.bp_vs_reality || []).filter((bp) =>
    watchKeywords.some((k) => bp.verdict?.toLowerCase().includes(k))
  );

  const questions = (analysis.key_questions || []).map((q) =>
    typeof q === "string" ? q : q.question
  );

  return (
    <div className="space-y-3 mb-6">
      {/* Row 1 — Score + Verdict */}
      <div className="rounded-2xl border bg-card p-4 flex items-start gap-4">
        {analysis.health_score && (
          <ScoreRing score={analysis.health_score.score} />
        )}
        <div className="flex-1 min-w-0">
          {analysis.health_score?.label && (
            <p className="text-sm font-semibold">{analysis.health_score.label}</p>
          )}
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
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

      {/* Row 2 — Alerts */}
      {sortedAlerts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {sortedAlerts.map((alert, i) => (
            <AlertCard key={i} alert={alert} />
          ))}
        </div>
      )}

      {/* Row 3 — BP vs Reality */}
      {(bpOnTrack.length > 0 || bpWatch.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* On track */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <CircleCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[11px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-400">
                On track
              </span>
            </div>
            {bpOnTrack.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-1">
                {bpOnTrack.map((bp, i) => (
                  <li key={i} className="flex items-baseline gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1" />
                    <span className="text-xs font-medium">{bp.metric}</span>
                    <span className="text-xs text-muted-foreground ml-auto truncate">
                      {bp.actual}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* À surveiller */}
          <div className="rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              <span className="text-[11px] uppercase tracking-wide font-semibold text-red-700 dark:text-red-400">
                À surveiller
              </span>
            </div>
            {bpWatch.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-1">
                {bpWatch.map((bp, i) => (
                  <li key={i} className="flex items-baseline gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1" />
                    <span className="text-xs font-medium">{bp.metric}</span>
                    <span className="text-xs text-muted-foreground ml-auto truncate">
                      {bp.actual}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Row 4 — Questions */}
      {questions.length > 0 && (
        <details className="rounded-xl border bg-card group">
          <summary className="flex items-center gap-2 p-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
            <MessageCircleQuestion className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold flex-1">
              Questions à poser ({questions.length})
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-3 pb-3 space-y-2">
            {questions.map((q, i) => (
              <p
                key={i}
                className="text-xs text-muted-foreground pl-4 border-l-2 border-muted py-0.5"
              >
                {q}
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
