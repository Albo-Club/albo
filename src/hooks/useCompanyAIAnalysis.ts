import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────

export interface TopInsight {
  metric_key: string;
  label: string;
  current_value: string;
  trend: string;
  trend_direction: "up" | "down" | "stable";
  context?: string;
}

export interface AIAlert {
  title: string;
  message: string;
  severity: "critical" | "warning" | "info";
}

export interface CompanyAnalysis {
  executive_summary: string;
  health_score: {
    score: number;
    label: string;
    rationale?: string;
    good_points?: string[];
    bad_points?: string[];
  };
  top_insights: TopInsight[];
  alerts?: AIAlert[];
  bp_vs_reality?: any[];
  key_questions?: any[];
  raw_markdown?: string;
}

export function useCompanyAIAnalysis(companyId: string) {
  const [analysis, setAnalysis] = useState<CompanyAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

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

  return { analysis, loading, analyzing, handleRunAnalysis };
}
