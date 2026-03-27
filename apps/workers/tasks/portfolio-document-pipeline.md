# Pipeline Process Portfolio Documents — Documentation

## Ce qui a été fait

### 1. Migration DB : `portfolio_company_metrics`
Ajout de 2 colonnes pour tracer l'origine des métriques :
- `source` (text) : `'report'` (email) ou `'document_upload'` (fichier uploadé manuellement)
- `source_document_id` (uuid, FK → portfolio_documents.id)

Cela permet à l'agent de distinguer les métriques du BP initial vs celles des reports mensuels.

### 2. Trigger.dev Task : `process-portfolio-document`
**Fichier** : `src/trigger/process-portfolio-document.ts`
**Task ID** : `process-portfolio-document`
**Déployé** : v20260317.5

Quand un fichier est uploadé dans `portfolio_documents` :
1. Télécharge le fichier depuis Supabase Storage (bucket `portfolio-documents`)
2. Extrait le contenu :
   - **PDF** → Mistral OCR (`extract-pdf.ts`)
   - **Excel/CSV** → XLSX parser (`extract-excel.ts`) + Claude Haiku (`extract-excel-metrics.ts`)
3. Stocke `text_content` dans `portfolio_documents` (colonne déjà existante, toujours null avant)
4. Extrait les métriques financières via Claude Haiku → upsert dans `portfolio_company_metrics` avec `source = 'document_upload'`
5. Chunk le texte (2000 chars) → insert dans `deck_embeddings` pour le contexte agent

### 3. DB Trigger : `handle_deck_file_upload`
**Table** : `portfolio_documents` (AFTER INSERT)
**Fonction** : `handle_deck_file_upload()`

Quand un fichier est inséré dans un dossier **Deck** ou **Reporting** :
- Appelle l'edge function `process-document-webhook` via `pg_net.http_post`
- Passe : `document_id`, `company_id`, `storage_path`, `mime_type`, `file_name`, `folder`

### 4. Edge Function : `process-document-webhook`
Reçoit l'appel pg_net et trigger la task Trigger.dev via l'API REST :
```
POST https://api.trigger.dev/api/v1/tasks/process-portfolio-document/trigger
```
`verify_jwt: false` (pg_net ne peut pas envoyer de JWT)

### 5. Edge Function : `company-intelligence` (v15)
`fetchFullContext` a été enrichi pour inclure :

| Source | Table | Champ utilisé | Quand |
|--------|-------|---------------|-------|
| Deck/BP uploadé (text) | `portfolio_documents` | `text_content` | Fichier uploadé manuellement |
| Deck/BP uploadé (chunks) | `deck_embeddings` | `content` | Chunks vectorisés |
| Métriques BP | `portfolio_company_metrics` | `source = 'document_upload'` | Métriques extraites du BP Excel |
| Reports email (text) | `company_reports` | `raw_content` | Contenu combiné des reports |
| Reports email (fichiers) | `report_files` | `original_text_report` | OCR des PJ de reports |
| Métriques reports | `portfolio_company_metrics` | `source = 'report'` | Métriques extraites des reports |

Le prompt d'analyse inclut déjà les règles 9-10 :
> **Règle 9** : Si des données de deck/BP ET des reports sont disponibles, compare les projections du BP avec les résultats réels. Mentionne les écarts significatifs.
> **Règle 10** : Les métriques `source="document_upload"` proviennent du deck/BP initial. Compare-les avec les métriques `source="report"` pour évaluer l'exécution.

---

## Ce qui reste à configurer côté Mastra

### L'agent Mastra (`company-intelligence`) sur Mastra Cloud

L'edge function Supabase sert de **proxy** : elle récupère toute la data et la passe à l'agent Mastra. L'agent appelle `fetchCompanyContextTool` → l'edge function répond avec le contexte enrichi.

**Le contexte JSON retourné par `fetchFullContext` inclut maintenant :**

```json
{
  "company": { ... },
  "deck": {
    "available": true,
    "chunks_count": 17,
    "full_text": "...(tout le texte du deck)...",
    "file_name": "Jeen - OC 2025..."
  },
  "uploaded_documents": {
    "count": 1,
    "items": [{ "name": "Jeen - OC 2025...", "mime_type": "xlsx", "text_length": 1357386 }],
    "full_text": "...(tout le texte extrait)..."
  },
  "reports": {
    "count": N,
    "items": [
      {
        "title": "...", "period": "...", "metrics": {...},
        "raw_content": "...(texte combiné)...",
        "attached_files_text": "...(OCR des PJ)...",
      }
    ]
  },
  "metrics": {
    "history": {
      "revenue": [
        { "value": "500000", "period": "2025", "source": "document_upload" },
        { "value": "480000", "period": "January 2026", "source": "report" }
      ]
    },
    "document_metrics_count": 24
  },
  "_meta": {
    "has_deck": true,
    "has_uploaded_docs": true,
    "has_reports": true,
    "has_document_metrics": true
  }
}
```

### Ce qu'il faut vérifier/adapter sur Mastra Cloud

1. **Le tool `fetchCompanyContextTool`** : doit appeler l'edge function `company-intelligence` avec `mode: 'context'`. Si c'est déjà le cas, rien à changer — le JSON enrichi est automatiquement transmis.

2. **Le system prompt de l'agent** : si l'agent a un system prompt sur Mastra Cloud, vérifier qu'il mentionne :
   - Utiliser `uploaded_documents.full_text` pour le contexte deck/BP
   - Utiliser `metrics.history[key]` pour voir l'évolution par source
   - Comparer `source: "document_upload"` (promesses BP) vs `source: "report"` (résultats réels)
   - Si `_meta.has_document_metrics` est true, faire la comparaison BP vs réalité

3. **Rien à changer dans l'edge function** : tout est déjà en place.

---

## Chaîne complète (résumé visuel)

```
Utilisateur upload un fichier dans l'app
          ↓
  INSERT portfolio_documents
          ↓
  DB trigger (handle_deck_file_upload)
          ↓
  pg_net → Edge Function (process-document-webhook)
          ↓
  Trigger.dev API → Task (process-portfolio-document)
          ↓
  ┌─ Download fichier depuis Storage
  ├─ Extract contenu (PDF=Mistral OCR, Excel=XLSX parser)
  ├─ Extract métriques (Claude Haiku) → portfolio_company_metrics
  ├─ Store text_content → portfolio_documents
  └─ Chunk text → deck_embeddings
          ↓
  Analyse demandée par l'utilisateur
          ↓
  Edge Function (company-intelligence, mode=analysis)
          ↓
  fetchFullContext() — récupère TOUT :
    - company info
    - deck chunks + uploaded_documents.text_content
    - reports + report_files OCR
    - metrics (avec source tracking)
          ↓
  Mastra Agent (company-intelligence)
    - Analyse le contexte complet
    - Compare BP (source=document_upload) vs Reports (source=report)
    - Recherche web (marché, concurrents)
          ↓
  Résultat sauvé dans portfolio_companies.ai_analysis
```

---

## Test effectué : Jeen BP Excel

| Étape | Résultat |
|-------|----------|
| Fichier | Jeen - OC 2025 X BP Croissance - 12 centres - Horizon 2032 |
| Trigger | DB trigger → edge function → Trigger.dev (run_cmmutgglp5chs0uohkpb6t4ez) |
| Extraction | 17 sheets, 1743 rows, 1,357,386 chars |
| Métriques | 24 métriques (total_financing, convertible_bond, bank_loans, cash_positions, etc.) |
| Chunks | 17 chunks dans deck_embeddings |
| Durée | 17 secondes |
