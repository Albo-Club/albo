# Migration deck@alboteam.com — Plan de travail

## Phase 1 : Types + Edge Function
- [x] `src/types/deck-analysis.ts` — interface DeckAnalysisResult
- [x] `albo-mastra/supabase/functions/deck-analysis/index.ts` — edge function

## Phase 2 : Memo HTML Builder
- [x] `src/steps/deck/build-memo-html.ts` — templating déterministe JSON → HTML

## Phase 3 : Steps pipeline
- [x] `src/steps/deck/download-deck.ts` — 6 routes (existait déjà)
- [x] `src/steps/deck/ocr-deck.ts` — Mistral OCR + nettoyage Haiku
- [x] `src/steps/deck/clean-email.ts` — nettoie HTML email + markdown
- [x] `src/steps/deck/check-account.ts` — vérifie profiles
- [x] `src/steps/deck/call-deck-analysis.ts` — appelle edge function
- [x] `src/steps/deck/create-deal.ts` — insert + PATCH deal
- [x] `src/steps/deck/store-deck-files.ts` — upload Storage + deck_files
- [x] `src/steps/deck/send-memo-email.ts` — Resend (memo + invitation + erreur)

## Phase 4 : Pipeline orchestrateur
- [x] `src/pipelines/deck-inbox.ts` — chaîne tous les steps

## Phase 5 : Server routes
- [x] `POST /webhook/deck` + `POST /test/deck` dans `src/server.ts`

## Phase 6 : Envoi via Unipile + langue + edge function routing

### 6a. Envoi email via Unipile (remplace Resend)
- [ ] Ajouter `sendEmail()` dans `src/lib/unipile.ts` — POST multipart/form-data `/api/v1/emails`
- [ ] Adapter `send-memo-email.ts` : envoyer via Unipile avec `account_id`, `to` (sender), `cc`, `bcc` originaux
- [ ] Garder `sendInvitationEmail` et `sendErrorEmail` via Resend (pas de reply nécessaire)

### 6b. Langue préférée dans le pipeline
- [ ] Modifier `check-account.ts` : récupérer `preferred_language` du profil
- [ ] Propager `preferred_language` dans le pipeline (parseEmail extrait déjà du payload webhook)
- [ ] Adapter `build-memo-html.ts` : labels bilingues FR/EN selon la langue
- [ ] Adapter `call-deck-analysis.ts` : passer la langue à l'agent Mastra pour que l'analyse soit dans la bonne langue

### 6c. Propagation CC/BCC dans l'envoi
- [ ] Extraire `bcc_attendees` dans `parse-email.ts` (si Unipile le fournit)
- [ ] `sendMemoEmail` reçoit `cc[]` et `bcc[]` du ParsedEmail et les transmet à Unipile

### 6d. Edge function : double routing (N8N + Express worker)
- [ ] Modifier `email-router-webhook` : pour route "deck", envoyer AUSSI au worker Express en parallèle du N8N
- [ ] URL worker : variable env `WORKER_BASE_URL` (ex: `http://vps-ip:3001`)
- [ ] Déployer edge function mise à jour

### 6e. Test & vérification
- [ ] Lancer le dernier email deck@ via `/test/deck` avec un `email_id` réel
- [ ] Vérifier : analyse Mastra OK, memo HTML dans la bonne langue, email envoyé via Unipile au sender + CC
- [ ] Vérifier logs dans `pipeline_logs`

---

# Migration Email Sync (N8N → TypeScript + Trigger.dev)

## Phase 1 : Steps + Pipeline
- [x] `src/steps/email-sync/load-domains.ts` — RPC get_user_portfolio_domains → DomainsMap
- [x] `src/steps/email-sync/match-emails.ts` — extraction domaines + matching
- [x] `src/steps/email-sync/store-matches.ts` — RPC upsert_email_matches_with_content
- [x] `src/pipelines/email-sync.ts` — pipeline standalone (Express, dev/test)
- [x] `src/trigger/email-sync.ts` — task Trigger.dev (prod, queues + retry)
- [x] Routes Express `/webhook/email-sync` + `/test/email-sync`
- [x] `trigger.config.ts` migré v4 defineConfig + bon projectRef
- [x] Typecheck clean
- [x] Logger `pipeline: "email-sync"` ajouté

## Phase 2 : Trigger.dev cloud + suppression N8N callback
- [x] Créer compte Trigger.dev cloud (org Albo, projet App albo)
- [x] Configurer env vars dans dashboard Trigger.dev
- [x] `trigger.config.ts` → v4 defineConfig, projectRef `proj_xypkgavwuptlyobbfulf`
- [x] Imports `@trigger.dev/sdk` (plus `/v3`)
- [x] TRIGGER_SECRET_KEY dans .env
- [x] **2a.** Task : remplacer callSyncComplete() par écriture directe DB (connected_accounts)
- [x] **2b.** Task : ajouter guard "compte déconnecté pendant sync" (check toutes les 10 pages)
- [x] **2c.** Deploy task via MCP (version 20260311.2, 1 task détectée)
- [x] **2d.** Edge function `start-email-sync` v15 : POST N8N → trigger Trigger.dev API
- [x] **2e.** Ajouter secret `TRIGGER_SECRET_KEY` dans Supabase Edge Functions
- [x] **2f.** Test sync sur un compte réel (Baptiste — 16K emails, 1014 matchs, 74 potential reports)
- [x] **2g.** Vérifier matchs en DB + logs dans dashboard Trigger.dev
- [x] **2g-bis.** Fix RPC `upsert_email_matches_with_content` : ajouter `is_potential_report` dans ON CONFLICT UPDATE
- [x] **2g-ter.** Scoring `is_potential_report` : subject (STRONG/MEDIUM/WEAK/TEMPORAL/NEGATIVE) + body (financial/structure/metrics/investor)
- [x] **2h.** Supprimer edge function `email-sync-complete` (supprimée le 2026-03-18)

## Phase 3 : Analyse historique des reports (post-sync)

### 3a-3e
- [x] Tous les steps implémentés et déployés (v20260312.6)
- [x] Test sur Baptiste : 19 reports Little Red Door créés
- [ ] Vérifier l'email récap reçu avec le tableau

---

# Pipeline Process Portfolio Documents

## Objectif
Quand un fichier est uploadé dans `portfolio_documents`, extraire le contenu, stocker les métriques
dans `portfolio_company_metrics` (avec source), vectoriser dans `deck_embeddings`,
et rendre le tout accessible à l'agent company-intelligence.

## Étapes

- [ ] **1. Migration DB** : ajouter `source` + `source_document_id` à `portfolio_company_metrics`
- [ ] **2. Trigger.dev task** `process-portfolio-document`
- [ ] **3. Modifier DB trigger** `handle_deck_file_upload` (tous types + appel pg_net)
- [ ] **4. Edge function** `process-document-webhook`
- [ ] **5. Update `fetchFullContext`** dans `company-intelligence`
- [ ] **6. Test** avec docs Jeen

---

# Hardening Trigger.dev — Solidifier le code (2026-03-25)

## Priorité 1 : Fiabilité (bloquant pour usage multi-user)

- [x] **1a.** `schemaTask` + Zod sur les 6 tasks exposées (deck-frontend, report-frontend, process-portfolio-document, email-sync, report-pipeline, deck-inbox)
- [x] **1b.** Fix return-au-lieu-de-throw dans `report-pipeline.ts` et `deck-inbox.ts` — retry Trigger.dev ne se déclenche pas si la task return normalement en cas d'échec
- [x] **1c.** Protéger `analyze-report.ts:160` — JSON.parse sans try/catch dédié
- [x] **1d.** Extraire constantes hardcodées → `src/lib/constants.ts` (UNIPILE_ACCOUNT_ID, NOTIFY_EMAIL)
- [x] **1e.** Valider env vars au démarrage — helper `requireEnv()` qui throw proprement

## Priorité 2 : Maintenabilité / DRY

- [x] **2b.** Standardiser logging : remplacer `console.*` par `logger` dans steps (call-deck-analysis, extract-excel-metrics, score-relevance, classify-report)
- [x] **2c.** Ajouter tags Trigger.dev (user_id, workspace_id, company_id) sur les 6 tasks pour filtrage dashboard

## Priorité 3 : Multi-tenant / Scale (plus tard)

- [ ] **3a.** Rate limiter les tasks frontend — queue par user
- [x] **3b.** Refactorer `report-frontend.ts` (441 → 138 lignes) — 4 steps extraits dans `src/steps/report/`

---

# Fix deck-frontend : statut bloqué + preview PDF (2026-03-24)

## Exécuté (backend / DB)
- [x] Deal Pascal (aiayu) : `status → "A traiter"` corrigé en DB
- [x] Backfill `deal_workspaces` : 46 deals manquants insérés (277/277 OK)
- [x] Migration DB : trigger `auto_create_deal_workspace` — chaque INSERT deals crée auto l'entrée deal_workspaces
- [x] 12 deals bloqués "en cours d'analyse" avec memo → corrigés à "A traiter"
- [x] 3 deals bloqués "en cours d'analyse" sans memo → marqués "error"

## À faire (frontend Lovable)
- [ ] Fix statut bloqué : ne pas écrire "en cours d'analyse" sans garantir qu'un task Trigger.dev est lancé
- [ ] Fix re-analyse : si l'utilisateur re-clique, vérifier si analyse déjà completed avant de reset le statut
- [ ] Voir prompt Lovable ci-dessous

---

# Fix metrics normalization — clés dénormalisées dans portfolio_company_metrics (2026-03-24)

## Contexte
Les metrics extraites des Excel/PDF sont stockées avec des clés brutes (`revenue_february`, `online_revenue_april`)
au lieu de clés normalisées (`revenue` + `report_period = "February 2026"`).
Résultat : le frontend voit 50+ "métriques" séparées au lieu de ~6 métriques avec historique mensuel.

Cause : `normalizeMetricKey()` dans `metric-aliases.ts` existe mais n'est pas utilisé à l'ingestion.

Problème secondaire : double extraction — `report-frontend` copie les fichiers dans `portfolio_documents`,
ce qui relance `process-portfolio-document` et re-extrait les mêmes metrics (352 doublons pour ACT Running).

## Phase 1 : Normalisation à l'ingestion (worker code)

- [x] **1a.** `report-frontend.ts` step 6 — `normalizeMetricsForDb()` avant upsert
- [x] **1b.** `process-portfolio-document.ts` step 3 — `normalizeMetricsForDb()` + skip si `source_report_id`
- [x] **1c.** `metric-aliases.ts` — ajouté `enrichPeriodWithYear()` + `normalizeMetricsForDb()`
- [x] **1d.** `process-portfolio-document.ts` — skip metric extraction si `source_report_id` renseigné

## Phase 2 : Nettoyage DB (toutes les companies)

- [x] **2a.** Script SQL : 492 metrics dénormalisées → clés canoniques (29 companies)
- [x] **2a-bis.** Nettoyage périodes sans année : 117 supprimées (doublon avec année), 54 enrichies
- [x] **2b.** `portfolio_companies.latest_metrics` recalculé pour ACT Running

## Phase 3 : Vérification

- [x] **3a.** ACT Running `revenue` : 12 data points mensuels (Feb 2025 → Feb 2026) + fiscal years
- [ ] **3b.** Vérifier que le frontend metrics tab affiche les courbes correctement
- [ ] **3c.** Tester un nouveau report submit → metrics normalisées automatiquement
- [ ] **3d.** Deploy worker (après validation frontend)

## Notes techniques
- Unique constraint : `(company_id, metric_key, report_period)` — 3 colonnes, correct
- DB trigger `update_company_metrics_from_report` : la FUNCTION existe mais AUCUN trigger ne l'utilise
  (peut être supprimée ou reconnectée avec la bonne logique)
- Le trigger `ON CONFLICT (company_id, metric_key)` dans cette function est FAUX (2 colonnes au lieu de 3)
- ACT Running actuellement : 446 metrics (352 document_upload + 94 report), devrait être ~50-60 normalisées
