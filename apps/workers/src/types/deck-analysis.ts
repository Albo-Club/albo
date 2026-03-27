/**
 * Contrat JSON entre l'agent Mastra "deck-analyzer" et le worker.
 * L'agent retourne ce JSON, le worker le transforme en memo HTML + deal Supabase.
 */

export interface DeckAnalysisResult {
  // --- Identité (pour le deal Supabase) ---
  company_name: string;
  sector: string;
  sub_sector: string;
  stage: string;
  funding_type: string;
  investment_amount_eur: number | null;
  one_liner: string;
  domain: string | null;

  // --- Contenu du memo (1 clé = 1 section HTML) ---

  en_30_secondes: {
    summary: string;
    badges: string[];
  };

  deal_structure: {
    rows: Array<{ label: string; value: string }>;
  };

  market_context: {
    market_size: string;
    dynamics: string;
    positioning: string;
  };

  business_fundamentals: Array<{
    metric: string;
    value: string;
    status: string;
    status_color: "green" | "red" | "neutral";
  }>;

  team: {
    founder_market_fit: string;
    members: Array<{
      name: string;
      role: string;
      background: string;
    }>;
    headcount: string | null;
    gaps: string | null;
  };

  traction_metrics: Array<{
    metric: string;
    value: string;
    performance: string;
    performance_color: "green" | "red" | "neutral";
  }>;

  solution_value_prop: Array<{
    title: string;
    description: string;
  }>;

  risks: Array<{
    title: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "CRITIQUE" | "ÉLEVÉ" | "MOYEN" | "FAIBLE";
    description: string;
    mitigation: string;
  }>;

  // --- Sections optionnelles ---

  investors_syndication: {
    lead: string | null;
    co_investors: string | null;
    history: string | null;
    use_of_funds: string | null;
  } | null;

  risk_profile: {
    ticket_recommendation: string;
    conditions: string | null;
  } | null;
}

/** Payload envoyé à l'edge function deck-analysis */
export interface DeckAnalysisRequest {
  deck_ocr_text: string;
  email_markdown: string;
  sender_email: string;
  email_subject: string;
  deck_source: "pdf_attachment" | "tally" | "docsend" | "google_drive" | "deck_link" | "text_only";
  /** Contenu additionnel extrait (pages Notion, etc.) */
  extra_content_markdown?: string;
  /** Langue de rédaction du memo (code ISO, ex: "fr", "en") */
  language?: string;
}

/** Réponse de l'edge function */
export interface DeckAnalysisResponse {
  success: boolean;
  analysis?: DeckAnalysisResult;
  error?: string;
}
