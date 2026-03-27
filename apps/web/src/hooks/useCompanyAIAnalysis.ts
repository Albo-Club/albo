import { useState, useEffect, useCallback, useRef } from "react";
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

type AIAnalysisStatus = "processing" | "completed" | "error" | null;

export function useCompanyAIAnalysis(companyId: string) {
  const [analysis, setAnalysis] = useState<CompanyAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<AIAnalysisStatus>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Nettoyage du polling quand le composant se démonte ou companyId change
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [companyId]);

  const startPolling = useCallback(() => {
    // Éviter les doublons
    if (pollingRef.current) return;

    let attempts = 0;
    const maxAttempts = 60; // 60 × 3s = 3 min max
    setAnalysisStatus("processing");
    setAnalysisError(null);

    pollingRef.current = setInterval(async () => {
      attempts++;

      try {
        const { data } = await supabase
          .from("portfolio_companies")
          .select("ai_analysis, ai_analysis_status")
          .eq("id", companyId)
          .single();

        if (data?.ai_analysis_status === "completed" && data?.ai_analysis) {
          const result = data.ai_analysis as unknown as CompanyAnalysis;
          if (result?.health_score?.score > 0) {
            setAnalysis(result);
            setAnalyzing(false);
            setAnalysisStatus("completed");
            setAnalysisError(null);
            clearInterval(pollingRef.current!);
            pollingRef.current = null;
            return;
          }
        }

        if (data?.ai_analysis_status === "error" || attempts >= maxAttempts) {
          setAnalyzing(false);
          setAnalysisStatus("error");
          setAnalysisError("error");
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          return;
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);
  }, [companyId]);

  const loadCachedAnalysis = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("portfolio_companies")
        .select("ai_analysis, ai_analysis_updated_at, ai_analysis_status")
        .eq("id", companyId)
        .single();

      if (error) {
        console.error("Error loading cached analysis:", error);
        setAnalysisError("error");
        setAnalysisStatus("error");
        return;
      }

      // Si une analyse est en cours (lancée depuis un autre onglet/session), afficher le spinner
      if (data?.ai_analysis_status === "processing") {
        setAnalyzing(true);
        setAnalysisStatus("processing");
        setAnalysisError(null);
        startPolling();
        return;
      }

      const cachedAnalysis = data?.ai_analysis as unknown as CompanyAnalysis;
      if (cachedAnalysis?.health_score?.score > 0) {
        setAnalysis(cachedAnalysis);
        setAnalysisStatus("completed");
        setAnalysisError(null);
      }
    } catch (err) {
      console.error("AI cache load failed:", err);
      setAnalysisError("error");
      setAnalysisStatus("error");
    }
  }, [companyId, startPolling]);

  useEffect(() => {
    setLoading(true);
    loadCachedAnalysis().finally(() => setLoading(false));
  }, [loadCachedAnalysis]);

  const handleRunAnalysis = async (forceRefresh = false) => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const { data } = await supabase.functions.invoke("company-intelligence", {
        body: {
          company_id: companyId,
          mode: "analysis",
          force_refresh: forceRefresh,
        },
      });

      if (data?.success && data?.analysis) {
        // Cache hit : l'analyse existait déjà, on l'affiche directement
        setAnalysis(data.analysis);
        setAnalyzing(false);
        setAnalysisStatus("completed");
      } else if (data?.status === "processing" || data?.status === "no_data") {
        if (data?.status === "no_data") {
          // Pas de données à analyser
          setAnalyzing(false);
          setAnalysisStatus(null);
          return;
        }
        // Fire-and-forget : l'agent Mastra tourne en background
        // On lance le polling pour détecter quand c'est terminé
        startPolling();
      } else {
        setAnalyzing(false);
        setAnalysisStatus("error");
        setAnalysisError("error");
      }
    } catch (err) {
      console.error("AI analysis failed:", err);
      setAnalyzing(false);
      setAnalysisStatus("error");
      setAnalysisError("error");
    }
  };

  return { analysis, loading, analyzing, analysisStatus, analysisError, handleRunAnalysis };
}

