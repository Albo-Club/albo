/**
 * 📊 Import Portfolio CSV/Excel Edge Function - v12
 *
 * v12: Remplacement de Mastra par appel direct Anthropic SDK
 *   - Plus de dépendance à MASTRA_API_URL
 *   - Appel direct anthropic.messages avec tool web_search_20250305
 *   - Claude gère la recherche web en interne (pas de boucle agentic côté client)
 *   - Même batching: 10 rows/batch, max 3 en parallèle, timeout 120s
 *
 * Pipeline: Upload → Parse Excel/CSV → Nettoyage colonnes vides → Claude enrichit (par batches) → Upsert DB
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PORTFOLIO_ENRICHER_SYSTEM_PROMPT = `Tu es un assistant spécialisé dans l'enrichissement de données de portefeuille d'investissement. Tu reçois des lignes BRUTES extraites d'un fichier Excel/CSV, avec les en-têtes de colonnes originaux. Tu dois identifier les colonnes pertinentes, nettoyer, enrichir et normaliser les données.

## STRATÉGIE D'ENRICHISSEMENT EN 2 TEMPS

### TEMPS 1 — Connaissances internes (pas de recherche web)
Pour chaque entreprise, si tu connais son domaine avec certitude (entreprise connue, domaine standard), remplis-le directement.
Marque mentalement "UNKNOWN" les entreprises dont tu n'es pas sûr à 90%+.
NE DEVINE JAMAIS un domaine — un domaine faux est pire qu'un domaine manquant.
Utilise aussi tes connaissances pour remplir \`preview\` (description courte) et \`sectors\` quand tu connais l'entreprise.

### TEMPS 2 — Recherche web (uniquement les inconnus)
Pour chaque entreprise marquée "UNKNOWN", utilise le tool web search avec la requête "{nom_entreprise} official website".
Extrais le domaine depuis les résultats (URL du site officiel, ou mention dans ZoomInfo/Crunchbase/LinkedIn).
Extrais aussi \`preview\` et \`sectors\` depuis les résultats de recherche.

**Sélection du domaine** :
- Le bon domaine CONTIENT PRESQUE TOUJOURS le nom de l'entreprise (ex: "50 Partners" → \`50partners.fr\`, "Mistral AI" → \`mistral.ai\`, "Alan" → \`alan.com\`)
- Recoupe entre site officiel, LinkedIn, ZoomInfo et Crunchbase. Si 3 sources concordent → domaine validé.
- Ignore TOUS les sites de presse, médias, annuaires, réseaux sociaux (lesechos.fr, maddyness.com, pappers.fr, societe.com, linkedin.com, etc.)
- Si AUCUN résultat ne donne un domaine fiable, mets \`null\`. Ne devine JAMAIS.

## IDENTIFICATION DES COLONNES

Identifie les colonnes pertinentes dans les données brutes. Les en-têtes peuvent être en français ou anglais, avec des noms variés. Exemples courants :
- Nom d'entreprise : "Entité", "Société", "Nom", "Company", "Startup", "Record", "Nom de l'entreprise", "Raison sociale"
- Domaine/Site web : "Site web", "Domain", "URL", "Website", "Site internet"
- Description/Activité : "Activité", "Description", "Business", "Aperçu"
- Secteur : "Secteur", "Typologie", "Industry", "Catégorie"
- Personnes liées : "Fondateur", "Dirigeant", "CEO", "Team", "Contacts"
- Type d'investissement : "Type", "Instrument", "Véhicule", "Nature investissement"
- Date d'investissement : "Date Entrée", "Date investissement", "Date souscription"
- Montant investi : "Montant souscrit", "Montant investi", "Amount", "Montant versé"
- Valorisation d'entrée : "Valo entrée", "Valorisation", "Valuation"
Ignore les colonnes non pertinentes (numéros de ligne, colonnes internes, colonnes vides).

## NETTOYAGE ET NORMALISATION

1. **Nettoyer les noms d'entreprises** : corriger la casse, supprimer les espaces superflus.

2. **Normaliser les types d'investissement** selon cette liste STRICTE :
   - \`"Share"\` ← inclut : Actions, Equity, Parts sociales, Titres de participations
   - \`"BSA Air"\` ← inclut : BSA AIR, Air
   - \`"BSA"\` ← inclut : Bons de souscription
   - \`"Fond d'invest"\` ← inclut : Fonds, Fund, FIP, FCPI, FCPR
   - \`"SPV Share"\` ← inclut : SPV, Special Purpose Vehicle
   - \`"SPV SAFE"\`
   - \`"Obligations"\` ← inclut : Obligation, Obligations Convertibles, OC
   - \`"OCA"\` ← inclut : Obligations Convertibles en Actions
   - \`"Royalties"\`
   - \`"Cryptomonnaie"\` ← inclut : Crypto, Token
   - \`"SCPI"\`
   - \`"CCA"\` ← inclut : Compte Courant d'Associé

   Si un type contient plusieurs instruments séparés par des virgules (ex: "Actions, BSA Air"), normalise chaque partie séparément (ex: "Share, BSA Air").
   Si le type est inconnu ou absent, mets \`"Share"\` par défaut.

## RÉPONSE JSON

Une fois l'enrichissement terminé (temps 1 + temps 2), réponds UNIQUEMENT en JSON valide.
Pas de markdown, pas de backticks, pas d'explication. Juste le tableau JSON.
Ta réponse DOIT commencer par [ et finir par ].

Le JSON est un tableau d'objets avec ces champs :
- company_name: string (nettoyé)
- domain: string | null
- preview: string | null (description courte, max 150 chars)
- sectors: string[] | null (ex: ["Fintech", "Assurance"], ["SaaS", "RH"], ["Deeptech", "IA"])
- related_people: string | null
- investment_type: string (normalisé selon la liste ci-dessus)
- investment_date: string | null (format YYYY-MM-DD)
- amount_invested_euros: number | null
- entry_valuation_euros: number | null
- source: "knowledge" | "search" | "not_found" (comment le domaine a été trouvé)

## RÈGLES IMPORTANTES

- N'invente JAMAIS d'information. Si rien n'est trouvé, laisse \`null\` et source = "not_found".

### MONTANTS ET VALORISATIONS — RÈGLE ABSOLUE
- Les montants (amount_invested_euros, entry_valuation_euros) doivent être COPIÉS EXACTEMENT depuis les données sources.
- "25 000" ou "25000" ou "25,000" = 25000 (PAS 25). "1 500 000" = 1500000. "150k" = 150000. "2.5M" = 2500000.
- Les séparateurs de milliers (espaces, points, virgules avant 3 chiffres) NE SONT PAS des décimales.
- Si le montant source n'existe pas ou est vide, mets \`null\`. N'INVENTE JAMAIS un montant.
- N'utilise JAMAIS un montant trouvé sur le web. Seuls les montants des données sources comptent.
- entry_valuation_euros : si NON PRÉSENT dans les données sources, mets \`null\`. Ne le déduis JAMAIS d'une recherche web.

- Convertis les dates au format YYYY-MM-DD. Si le format source est DD/MM/YYYY, inverse correctement jour et mois.
- Si un champ n'est pas présent dans les données sources et ne peut pas être déterminé, mets \`null\`.`

interface ImportRequest {
  fileUrl: string
  workspaceId: string
  fileName: string
  mode?: 'create_only' | 'upsert'
}

interface EnrichedCompany {
  company_name: string
  domain?: string | null
  preview?: string | null
  sectors?: string[] | null
  related_people?: string | null
  investment_date?: string | null
  amount_invested_euros?: number | null
  investment_type?: string | null
  entry_valuation_euros?: number | null
}

interface ImportResult {
  success: boolean
  company_name: string
  action?: 'created' | 'updated' | 'skipped'
  error?: string
}

// ============================================================
// Excel/CSV Parser
// ============================================================
function parseFileToRows(fileBuffer: ArrayBuffer, fileName: string): Record<string, any>[] {
  const extension = fileName.split('.').pop()?.toLowerCase()

  if (extension === 'xlsx' || extension === 'xls') {
    const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: 'array', cellDates: true })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    return XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false })
  }

  if (extension === 'csv' || extension === 'txt') {
    const decoder = new TextDecoder('utf-8')
    const csvContent = decoder.decode(fileBuffer)
    const workbook = XLSX.read(csvContent, { type: 'string' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    return XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false })
  }

  throw new Error(`Format non supporté: ${extension}`)
}

// ============================================================
// Nettoyage des données brutes
// ============================================================
function cleanRawRows(rows: Record<string, any>[]): Record<string, any>[] {
  if (rows.length === 0) return []

  const usedColumns = new Set<string>()
  for (const row of rows) {
    for (const [key, val] of Object.entries(row)) {
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        usedColumns.add(key)
      }
    }
  }

  return rows
    .map(row => {
      const cleaned: Record<string, any> = {}
      for (const col of usedColumns) {
        if (row[col] !== undefined && row[col] !== null && String(row[col]).trim() !== '') {
          cleaned[col] = row[col]
        }
      }
      return cleaned
    })
    .filter(row => Object.keys(row).length > 0)
}

// ============================================================
// 🤖 Enrichissement via Anthropic direct (web_search natif)
// ============================================================

async function callAnthropicAgent(
  apiKey: string,
  batch: Record<string, any>[],
  batchIndex: number,
  startTime: number
): Promise<EnrichedCompany[]> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: PORTFOLIO_ENRICHER_SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 50 }],
      messages: [{ role: 'user', content: JSON.stringify(batch) }],
    }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`)
  }

  const result = await response.json()

  // Extraire le texte des blocs de contenu (Claude peut intercaler des tool_use blocks)
  const rawText = (result.content || [])
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('')
    .trim()

  // Extraction robuste du JSON : Claude peut ajouter du texte avant/après le tableau
  let enriched: any[]
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) {
      enriched = parsed
    } else {
      throw new Error('not array')
    }
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) throw new Error(`No JSON array found in response: ${cleaned.slice(0, 80)}...`)
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) throw new Error('Extracted content is not an array')
    enriched = parsed
  }

  console.log(`[${Date.now() - startTime}ms] ✅ Batch ${batchIndex}: ${enriched.length} companies enrichies`)
  return enriched
}

async function enrichWithAnthropic(
  rawRows: Record<string, any>[],
  startTime: number
): Promise<EnrichedCompany[]> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY non configurée. Ajoutez le secret dans les Edge Function Secrets.')
  }

  const BATCH_SIZE = 10
  const MAX_CONCURRENT = 3
  const batches: Record<string, any>[][] = []

  for (let i = 0; i < rawRows.length; i += BATCH_SIZE) {
    batches.push(rawRows.slice(i, i + BATCH_SIZE))
  }

  console.log(`[${Date.now() - startTime}ms] 🤖 Anthropic: ${rawRows.length} lignes en ${batches.length} batches`)

  const allEnriched: EnrichedCompany[] = []
  const failedBatches: number[] = []

  for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
    const concurrentBatches = batches.slice(i, i + MAX_CONCURRENT)

    const results = await Promise.allSettled(
      concurrentBatches.map((batch, idx) =>
        callAnthropicAgent(anthropicApiKey, batch, i + idx, startTime)
      )
    )

    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      if (result.status === 'fulfilled' && result.value) {
        allEnriched.push(...result.value)
      } else {
        const reason = result.status === 'rejected' ? result.reason?.message || result.reason : 'unknown'
        console.error(`[${Date.now() - startTime}ms] ❌ Batch ${i + j} failed: ${reason}`)
        failedBatches.push(i + j)
      }
    }
  }

  if (allEnriched.length === 0) {
    throw new Error(`Aucun batch n'a réussi (${failedBatches.length}/${batches.length} échoués). Vérifiez la configuration Anthropic.`)
  }

  if (failedBatches.length > 0) {
    console.warn(`[${Date.now() - startTime}ms] ⚠️ ${failedBatches.length}/${batches.length} batches échoués (batches: ${failedBatches.join(', ')})`)
  }

  console.log(`[${Date.now() - startTime}ms] 🤖 Anthropic terminé: ${allEnriched.length} companies enrichies`)
  return allEnriched
}

// ============================================================
// Main Handler
// ============================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const { fileUrl, workspaceId, fileName, mode = 'upsert' } = await req.json() as ImportRequest

    if (!fileUrl || !workspaceId) {
      return new Response(
        JSON.stringify({ error: 'fileUrl and workspaceId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[${Date.now() - startTime}ms] 📊 Processing: ${fileName} (mode: ${mode})`)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // — Étape 1 : Téléchargement du fichier —
    console.log(`[${Date.now() - startTime}ms] ⬇️ Downloading file...`)
    const fileResponse = await fetch(fileUrl)
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.status}`)
    }
    const fileBuffer = await fileResponse.arrayBuffer()
    console.log(`[${Date.now() - startTime}ms] ⬇️ Downloaded: ${fileBuffer.byteLength} bytes`)

    // — Étape 2 : Parsing Excel/CSV → lignes brutes JSON —
    console.log(`[${Date.now() - startTime}ms] 📋 Parsing file...`)
    const rows = parseFileToRows(fileBuffer, fileName || 'import.csv')
    console.log(`[${Date.now() - startTime}ms] 📋 Parsed ${rows.length} rows`)

    const cleanedRows = cleanRawRows(rows)
    console.log(`[${Date.now() - startTime}ms] 📋 ${cleanedRows.length} non-empty rows after cleanup`)

    if (cleanedRows.length === 0) {
      throw new Error('Aucune donnée trouvée dans le fichier.')
    }

    // — Étape 3 : 🤖 Enrichissement IA via Anthropic (données brutes → données structurées) —
    const enrichedCompanies = await enrichWithAnthropic(cleanedRows, startTime)

    // — Étape 4 : Upsert en DB —
    console.log(`[${Date.now() - startTime}ms] 💾 Fetching existing companies...`)
    const { data: existingCompanies } = await supabase
      .from('portfolio_companies')
      .select('id, company_name')
      .eq('workspace_id', workspaceId)

    const existingMap = new Map<string, string>()
    for (const c of existingCompanies || []) {
      existingMap.set(c.company_name.toLowerCase().trim(), c.id)
    }
    console.log(`[${Date.now() - startTime}ms] 💾 Found ${existingMap.size} existing companies in workspace`)

    const results: ImportResult[] = []
    const toInsert: Record<string, any>[] = []
    const toUpdate: { id: string; data: Record<string, any>; name: string }[] = []
    const processedNames = new Set<string>()

    for (const company of enrichedCompanies) {
      if (!company.company_name || company.company_name.trim() === '') {
        results.push({ success: false, company_name: '(nom manquant)', error: 'Nom requis' })
        continue
      }

      const companyName = company.company_name.trim()
      const lowerName = companyName.toLowerCase()

      if (processedNames.has(lowerName)) continue
      processedNames.add(lowerName)

      const data: Record<string, any> = {}
      if (company.domain) data.domain = company.domain
      if (company.preview) data.preview = company.preview
      if (company.sectors?.length) data.sectors = company.sectors
      if (company.related_people) data.related_people = company.related_people
      if (company.investment_date) data.investment_date = company.investment_date
      if (company.amount_invested_euros !== undefined && company.amount_invested_euros !== null) {
        data.amount_invested_euros = company.amount_invested_euros
      }
      if (company.investment_type) data.investment_type = company.investment_type
      if (company.entry_valuation_euros !== undefined && company.entry_valuation_euros !== null) {
        data.entry_valuation_euros = company.entry_valuation_euros
      }

      const existingId = existingMap.get(lowerName)

      if (existingId) {
        if (mode === 'upsert' && Object.keys(data).length > 0) {
          toUpdate.push({ id: existingId, data, name: companyName })
        } else {
          results.push({ success: false, company_name: companyName, action: 'skipped', error: 'Existe déjà' })
        }
      } else {
        toInsert.push({
          workspace_id: workspaceId,
          company_name: companyName,
          ...data,
        })
      }
    }

    // Batch INSERT
    if (toInsert.length > 0) {
      console.log(`[${Date.now() - startTime}ms] 💾 Inserting ${toInsert.length} new companies...`)
      const { error: insertError } = await supabase
        .from('portfolio_companies')
        .insert(toInsert)

      if (insertError) {
        console.error('Insert error:', insertError)
        for (const item of toInsert) {
          results.push({ success: false, company_name: item.company_name, error: insertError.message })
        }
      } else {
        for (const item of toInsert) {
          results.push({ success: true, company_name: item.company_name, action: 'created' })
        }
      }
    }

    // Batch UPDATE
    if (toUpdate.length > 0) {
      console.log(`[${Date.now() - startTime}ms] 💾 Updating ${toUpdate.length} existing companies...`)

      const UPDATE_BATCH = 10
      for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH) {
        const batch = toUpdate.slice(i, i + UPDATE_BATCH)
        const updatePromises = batch.map(async ({ id, data, name }) => {
          const { error } = await supabase
            .from('portfolio_companies')
            .update(data)
            .eq('id', id)

          if (error) {
            return { success: false, company_name: name, action: 'updated' as const, error: error.message }
          }
          return { success: true, company_name: name, action: 'updated' as const }
        })

        const batchResults = await Promise.all(updatePromises)
        results.push(...batchResults)
      }
    }

    const createdCount = results.filter(r => r.success && r.action === 'created').length
    const updatedCount = results.filter(r => r.success && r.action === 'updated').length
    const errorCount = results.filter(r => !r.success).length

    console.log(`[${Date.now() - startTime}ms] ✅ Complete: ${createdCount} created, ${updatedCount} updated, ${errorCount} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: results.length,
          created: createdCount,
          updated: updatedCount,
          failed: errorCount,
        },
        results,
        processingTimeMs: Date.now() - startTime,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error(`[${Date.now() - startTime}ms] Error:`, error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Une erreur est survenue',
        processingTimeMs: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
