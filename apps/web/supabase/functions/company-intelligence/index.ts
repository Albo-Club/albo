/**
 * Edge Function: company-intelligence v2
 * Analyse IA d'une portfolio company — appel direct Anthropic SDK (sans Mastra).
 *
 * Appelé par le frontend via supabase.functions.invoke("company-intelligence", {
 *   body: { company_id, mode: "analysis", force_refresh }
 * })
 *
 * Flow :
 *  1. Vérifie cache (ai_analysis_status === "completed" && !force_refresh) → retourne direct
 *  2. Set ai_analysis_status = "processing" → retourne HTTP 200 immédiatement
 *  3. Background (EdgeRuntime.waitUntil) : fetch context DB → Claude → update DB
 *  4. Frontend poll DB toutes les 3s jusqu'à ai_analysis_status === "completed"
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ============================================================
// System prompt (extrait de apps/mastra/src/mastra/agents/company-intelligence.ts)
// ============================================================
const COMPANY_INTELLIGENCE_SYSTEM_PROMPT = `# Agent company-intelligence — System Prompt v3

Tu es un analyste d'investissement senior pour Business Angels. Tu produis des analyses concises et équilibrées.

## POSTURE

- **Équilibré** : toujours montrer le positif ET le négatif. Une startup early-stage avec du burn, c'est normal.
- **Concis** : chaque mot doit apporter de l'information. Pas d'adjectifs superflus.
- **Factuel** : des chiffres, pas des opinions. "CA 86k€ (-11% MoM)" pas "chute dramatique".

## INSTRUCTIONS

Les données de la company sont fournies dans le message utilisateur.
Fais 2-3 recherches web (marché, concurrents, actualités) via linkup_search.
Réponds UNIQUEMENT avec un bloc \`\`\`json — AUCUN texte avant ou après.

## FORMAT DE SORTIE STRICT

\`\`\`json
{
  "executive_summary": "2 phrases max. Fait positif + fait négatif.",

  "health_score": {
    "score": 6,
    "label": "En bonne voie",
    "good_points": [
      "CA YTD 1M€ HT (+105% YoY)",
      "Pivot gros comptes validé (AOV +57%)",
      "Levée 530k€ finalisée"
    ],
    "bad_points": [
      "Acquisition -57% MoM en décembre",
      "Runway 6-7 mois au burn actuel",
      "Pipeline en baisse (-17%)"
    ]
  },

  "top_insights": [
    {
      "metric_key": "revenue",
      "label": "CA mensuel",
      "current_value": "86k€",
      "trend": "-11%",
      "trend_direction": "down",
      "context": "MoM, YTD +105% YoY"
    },
    {
      "metric_key": "cash_position",
      "label": "Trésorerie",
      "current_value": "426k€",
      "trend": "-14%",
      "trend_direction": "down",
      "context": "Runway 6-7 mois"
    },
    {
      "metric_key": "aov",
      "label": "Panier moyen",
      "current_value": "6 600€",
      "trend": "+57%",
      "trend_direction": "up",
      "context": "Pivot gros comptes validé"
    }
  ],

  "alerts": [
    {
      "severity": "critical",
      "title": "Runway 6-7 mois",
      "message": "Anticiper le prochain financement"
    },
    {
      "severity": "info",
      "title": "Pivot gros comptes validé",
      "message": "AOV +57% MoM"
    }
  ]
}
\`\`\`

## RÈGLES EXECUTIVE_SUMMARY
- **2 phrases MAXIMUM**
- Phrase 1 : le fait positif principal avec un chiffre
- Phrase 2 : le point de vigilance principal avec un chiffre

## RÈGLES HEALTH_SCORE
- score : entier de 1 à 10
- label : "Excellent" (8-10), "En bonne voie" (6-7), "À surveiller" (4-5), "Préoccupant" (2-3), "Critique" (1)
- good_points : EXACTEMENT 3 items, chacun max 8 mots avec 1 chiffre
- bad_points : EXACTEMENT 3 items, chacun max 8 mots avec 1 chiffre

## RÈGLES TOP_INSIGHTS (CRITIQUE)
- **EXACTEMENT 3** — les 3 KPI les plus importants
- current_value : OBLIGATOIRE, le chiffre exact du dernier report. JAMAIS vide.
- trend : OBLIGATOIRE, la variation en %. JAMAIS vide.
- trend_direction : "up" (positif), "down" (négatif), "stable"
- **Équilibre** : au moins 1 insight positif si la boîte a un trend_direction "up"

## RÈGLES ALERTS
- **Maximum 3 alerts** (pas plus !)
- severity : "critical" (1 max), "warning" (1 max), "info" (1 — toujours 1 positif)
- title : 4-6 mots MAX
- message : 1 bout de phrase, max 10 mots
- **TOUJOURS 1 alert "info" positive**

## COMPARAISON BP/DECK vs REPORTS
Quand le contexte contient à la fois des documents uploadés (projections BP) et des reports email (résultats réels) :
- Compare les projections BP avec les résultats réels
- Mentionne les écarts significatifs dans executive_summary, top_insights ou alerts
- Si l'exécution est meilleure que le BP, le souligner positivement

## IMPORTANT
- AUCUN texte avant le \`\`\`json ni après le \`\`\`
- AUCUN champ vide pour top_insights
- EXACTEMENT 3 good_points et 3 bad_points
- EXACTEMENT 3 top_insights
- MAXIMUM 3 alerts
- Le JSON ne contient QUE : executive_summary, health_score, top_insights, alerts`

// ============================================================
// Main Handler
// ============================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { company_id, mode, force_refresh } = body

    if (!company_id) {
      return new Response(
        JSON.stringify({ error: 'company_id requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Mode "analysis" : déclenchement de l'analyse IA
    if (mode === 'analysis') {
      // Vérification cache
      if (!force_refresh) {
        const { data: existing } = await supabase
          .from('portfolio_companies')
          .select('ai_analysis, ai_analysis_status')
          .eq('id', company_id)
          .single()

        if (existing?.ai_analysis_status === 'completed' && existing?.ai_analysis) {
          return new Response(
            JSON.stringify({ status: 'completed', analysis: existing.ai_analysis }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      // Marquer comme en cours et retourner immédiatement
      await supabase
        .from('portfolio_companies')
        .update({ ai_analysis_status: 'processing' })
        .eq('id', company_id)

      // Analyse en background (ne bloque pas la réponse HTTP)
      // @ts-ignore - EdgeRuntime disponible dans Supabase edge functions
      EdgeRuntime.waitUntil(
        runAnalysis(supabase, company_id).catch((err) => {
          console.error(`[company-intelligence] Analyse échouée pour ${company_id}:`, err)
          supabase
            .from('portfolio_companies')
            .update({ ai_analysis_status: 'error' })
            .eq('id', company_id)
            .then(() => {})
        })
      )

      return new Response(
        JSON.stringify({ status: 'processing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fallback sans mode : retourne les données brutes de la company (legacy)
    const context = await fetchCompanyContext(supabase, company_id)
    return new Response(
      JSON.stringify({ success: true, company_id, context }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('[company-intelligence] Erreur:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================================
// Analyse IA en background
// ============================================================
async function runAnalysis(supabase: any, company_id: string): Promise<void> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY non configurée')

  const anthropic = new Anthropic({ apiKey: anthropicKey })

  // 1. Récupérer le contexte company depuis la DB
  const contextText = await fetchCompanyContext(supabase, company_id)

  if (!contextText) {
    await supabase
      .from('portfolio_companies')
      .update({ ai_analysis_status: 'no_data' })
      .eq('id', company_id)
    return
  }

  // 2. Boucle agentique Claude
  const userMessage = `Analyse cette portfolio company. Fais 2-3 recherches web pour compléter le contexte.\n\n${contextText}`

  const messages: any[] = [{ role: 'user', content: userMessage }]

  const tools = [
    {
      name: 'linkup_search',
      description: 'Recherche web pour enrichir l\'analyse (marché, concurrents, actualités).',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Requête de recherche' },
          category: { type: 'string', description: 'Catégorie de recherche' },
        },
        required: ['query', 'category'],
      },
    },
  ]

  let fullText = ''

  for (let step = 0; step < 15; step++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: COMPANY_INTELLIGENCE_SYSTEM_PROMPT,
      tools: tools as any,
      messages,
    })

    console.log(`[company-intelligence] Step ${step}: stop_reason=${response.stop_reason}`)

    if (response.stop_reason === 'end_turn') {
      for (const block of response.content as any[]) {
        if (block.type === 'text') fullText += block.text
      }
      break
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content })

      const toolResults: any[] = []

      for (const block of response.content as any[]) {
        if (block.type === 'tool_use' && block.name === 'linkup_search') {
          const { query, category } = block.input as { query: string; category: string }
          console.log(`[company-intelligence] linkup_search: ${query}`)

          try {
            const searchResult = await linkupSearch(query)
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ category, query, summary: searchResult }),
            })
          } catch (err: any) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `Erreur recherche: ${err.message}`,
              is_error: true,
            })
          }
        }
      }

      messages.push({ role: 'user', content: toolResults })
    }
  }

  // 3. Parser le JSON
  const analysis = extractJsonFromText(fullText)

  if (!analysis?.executive_summary) {
    throw new Error(`JSON invalide: executive_summary manquant. Texte: ${fullText.slice(0, 200)}`)
  }

  // 4. Sauvegarder en DB
  await supabase
    .from('portfolio_companies')
    .update({
      ai_analysis: analysis,
      ai_analysis_status: 'completed',
      ai_analysis_updated_at: new Date().toISOString(),
    })
    .eq('id', company_id)

  console.log(`[company-intelligence] Analyse complète pour ${company_id}`)
}

// ============================================================
// Récupération du contexte company depuis Supabase
// ============================================================
async function fetchCompanyContext(supabase: any, company_id: string): Promise<string> {
  const parts: string[] = []

  // Company info
  const { data: company } = await supabase
    .from('portfolio_companies')
    .select('company_name, domain, sectors, preview, investment_date, investment_type, amount_invested_euros, entry_valuation_euros, related_people')
    .eq('id', company_id)
    .single()

  if (!company) return ''

  parts.push(`## Entreprise: ${company.company_name}`)
  if (company.domain) parts.push(`Domaine: ${company.domain}`)
  if (company.sectors?.length) parts.push(`Secteurs: ${company.sectors.join(', ')}`)
  if (company.preview) parts.push(`Description: ${company.preview}`)
  if (company.investment_date) parts.push(`Date d'investissement: ${company.investment_date}`)
  if (company.investment_type) parts.push(`Type d'investissement: ${company.investment_type}`)
  if (company.amount_invested_euros) parts.push(`Montant investi: ${company.amount_invested_euros}€`)
  if (company.entry_valuation_euros) parts.push(`Valorisation d'entrée: ${company.entry_valuation_euros}€`)
  if (company.related_people) parts.push(`Équipe/Fondateurs: ${company.related_people}`)

  // Métriques historiques
  const { data: metrics } = await supabase
    .from('portfolio_company_metrics')
    .select('metric_key, metric_value, metric_type, report_period, source, period_sort_date')
    .eq('company_id', company_id)
    .order('period_sort_date', { ascending: false })

  if (metrics?.length) {
    parts.push('\n## Métriques historiques')
    const grouped: Record<string, any[]> = {}
    for (const m of metrics) {
      if (!grouped[m.metric_key]) grouped[m.metric_key] = []
      grouped[m.metric_key].push(m)
    }
    for (const [key, values] of Object.entries(grouped)) {
      const history = values
        .map((v: any) => `${v.report_period ?? v.period_sort_date}: ${v.metric_value} [${v.source}]`)
        .join(', ')
      parts.push(`${key}: ${history}`)
    }
  }

  // 5 derniers reports
  const { data: reports } = await supabase
    .from('company_reports')
    .select('id, report_title, report_date, report_period, headline, key_highlights, metrics, cleaned_content')
    .eq('company_id', company_id)
    .eq('is_archived', false)
    .order('report_date', { ascending: false })
    .limit(5)

  if (reports?.length) {
    // Fichiers joints (OCR text) pour ces reports
    const reportIds = reports.map((r: any) => r.id)
    const { data: files } = await supabase
      .from('report_files')
      .select('report_id, file_name, file_type, original_text_report')
      .in('report_id', reportIds)
      .eq('is_archived', false)
      .not('original_text_report', 'is', null)
      .neq('file_type', 'inline_image')

    const filesByReport: Record<string, any[]> = {}
    for (const f of files ?? []) {
      if (!filesByReport[f.report_id]) filesByReport[f.report_id] = []
      filesByReport[f.report_id].push(f)
    }

    parts.push('\n## Reports investisseur (5 derniers)')
    for (const report of reports) {
      parts.push(`\n### ${report.report_title ?? report.report_period ?? 'Report'} (${report.report_date})`)
      if (report.headline) parts.push(`Titre: ${report.headline}`)
      if (report.key_highlights?.length) parts.push(`Points clés: ${report.key_highlights.join(' | ')}`)
      if (report.metrics) parts.push(`Métriques: ${JSON.stringify(report.metrics)}`)
      if (report.cleaned_content) parts.push(`Contenu:\n${report.cleaned_content.slice(0, 3000)}`)

      const attachedFiles = filesByReport[report.id] ?? []
      for (const file of attachedFiles) {
        if (file.original_text_report) {
          parts.push(`\nFichier joint (${file.file_name}):\n${file.original_text_report.slice(0, 2000)}`)
        }
      }
    }
  }

  return parts.join('\n')
}

// ============================================================
// Linkup REST API (pas de SDK requis en Deno)
// ============================================================
async function linkupSearch(query: string): Promise<string> {
  const apiKey = Deno.env.get('LINKUP_API_KEY')
  if (!apiKey) return 'Recherche web non disponible (LINKUP_API_KEY manquante)'

  const resp = await fetch('https://api.linkup.so/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, depth: 'deep', outputType: 'searchResults', maxResults: 5 }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!resp.ok) return `Recherche échouée: HTTP ${resp.status}`

  const data = await resp.json()
  const results = data.results ?? []

  return results
    .map((r: any) => `${r.name ?? r.title ?? 'Source'}: ${(r.content ?? '').slice(0, 400)}`)
    .join('\n\n') || 'Aucun résultat trouvé.'
}

// ============================================================
// Extraction JSON robuste
// ============================================================
function extractJsonFromText(rawText: string): any {
  const jsonBlockMatch = rawText.match(/```json\s*([\s\S]*?)(\s*```|\s*$)/)
  if (jsonBlockMatch) {
    try { return JSON.parse(jsonBlockMatch[1].trim()) } catch { /* fallback */ }
  }

  const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
  try { return JSON.parse(cleaned) } catch { /* fallback */ }

  const openIdx = cleaned.indexOf('{')
  if (openIdx !== -1) {
    let depth = 0, closeIdx = -1
    for (let i = openIdx; i < cleaned.length; i++) {
      if (cleaned[i] === '{') depth++
      else if (cleaned[i] === '}') { depth--; if (depth === 0) { closeIdx = i; break } }
    }
    if (closeIdx !== -1) {
      try { return JSON.parse(cleaned.substring(openIdx, closeIdx + 1)) } catch { /* abandon */ }
    }
  }

  console.error(`[company-intelligence] JSON parsing échoué. Texte: ${rawText.slice(0, 300)}`)
  return null
}
