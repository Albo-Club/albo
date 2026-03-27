/**
 * 📊 Import Portfolio CSV/Excel Edge Function - v11
 *
 * v11: Parsing simplifié — envoie les données brutes à l'agent Mastra
 *   - Plus de column mapping rigide côté edge function
 *   - L'agent LLM identifie les colonnes et extrait/enrichit les données
 *   - Batching: 10 rows/batch (raw data = plus de tokens), max 3 en parallèle
 *   - Timeout 120s par batch
 *
 * Pipeline: Upload → Parse Excel/CSV → Nettoyage colonnes vides → Mastra enrichit (par batches) → Upsert DB
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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
// Supprime les colonnes entièrement vides et les lignes vides
// pour réduire les tokens envoyés à l'agent
// ============================================================
function cleanRawRows(rows: Record<string, any>[]): Record<string, any>[] {
  if (rows.length === 0) return []

  // Trouver les colonnes qui ont au moins une valeur non vide
  const usedColumns = new Set<string>()
  for (const row of rows) {
    for (const [key, val] of Object.entries(row)) {
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        usedColumns.add(key)
      }
    }
  }

  // Garder uniquement les colonnes utilisées et filtrer les lignes vides
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
// 🤖 Enrichissement via agent Mastra
// ============================================================

/**
 * Envoie un batch de lignes brutes à l'agent Mastra.
 * L'agent identifie les colonnes, extrait, nettoie et enrichit les données.
 */
async function callMastraAgent(
  apiUrl: string,
  batch: Record<string, any>[],
  batchIndex: number,
  startTime: number
): Promise<EnrichedCompany[]> {
  const response = await fetch(
    `${apiUrl}/api/agents/portfolio-enricher/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: JSON.stringify(batch) }],
      }),
      signal: AbortSignal.timeout(120_000),
    }
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`)
  }

  const result = await response.json()
  const rawText = (result?.text || '').trim()

  // Extraction robuste du JSON : l'agent peut ajouter du texte avant/après le tableau
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
    // Fallback: chercher un tableau JSON dans le texte
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) throw new Error(`No JSON array found in response: ${cleaned.slice(0, 80)}...`)
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) throw new Error('Extracted content is not an array')
    enriched = parsed
  }

  console.log(`[${Date.now() - startTime}ms] ✅ Batch ${batchIndex}: ${enriched.length} companies enrichies`)
  return enriched
}

/**
 * Orchestre l'enrichissement par batches de 10, max 3 en parallèle.
 * Chaque batch qui échoue est loggé (pas de fallback possible sans pre-parsing).
 */
async function enrichWithMastra(
  rawRows: Record<string, any>[],
  startTime: number
): Promise<EnrichedCompany[]> {
  const mastraApiUrl = Deno.env.get('MASTRA_API_URL')

  if (!mastraApiUrl) {
    throw new Error('MASTRA_API_URL non configurée. Ajoutez le secret dans les Edge Function Secrets.')
  }

  const BATCH_SIZE = 10
  const MAX_CONCURRENT = 3
  const batches: Record<string, any>[][] = []

  for (let i = 0; i < rawRows.length; i += BATCH_SIZE) {
    batches.push(rawRows.slice(i, i + BATCH_SIZE))
  }

  console.log(`[${Date.now() - startTime}ms] 🤖 Mastra: ${rawRows.length} lignes en ${batches.length} batches`)

  const allEnriched: EnrichedCompany[] = []
  const failedBatches: number[] = []

  for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
    const concurrentBatches = batches.slice(i, i + MAX_CONCURRENT)

    const results = await Promise.allSettled(
      concurrentBatches.map((batch, idx) =>
        callMastraAgent(mastraApiUrl, batch, i + idx, startTime)
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
    throw new Error(`Aucun batch n'a réussi (${failedBatches.length}/${batches.length} échoués). Vérifiez la connexion à Mastra.`)
  }

  if (failedBatches.length > 0) {
    console.warn(`[${Date.now() - startTime}ms] ⚠️ ${failedBatches.length}/${batches.length} batches échoués (batches: ${failedBatches.join(', ')})`)
  }

  console.log(`[${Date.now() - startTime}ms] 🤖 Mastra terminé: ${allEnriched.length} companies enrichies`)
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

    // — Étape 3 : 🤖 Enrichissement IA via Mastra (données brutes → données structurées) —
    const enrichedCompanies = await enrichWithMastra(cleanedRows, startTime)

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

      // Déduplication dans le même import
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
