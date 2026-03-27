# Lessons Learned

## Re-import de report archivé → désarchiver automatiquement
**Date** : 2026-03-26
**Contexte** : Eutopia Q4 2025 ré-importé depuis le frontend mais invisible. Le pipeline détecte le duplicate et fait un UPDATE, mais `is_archived` restait `true`.
**Cause** : `updateReport()` ne touchait pas les champs d'archivage lors d'un re-import.
**Fix** : Ajouter `is_archived: false, archive_reason: null, archived_at: null, archived_by: null` dans l'UPDATE de `updateReport()`.
**Règle** : Quand un record est mis à jour par une action utilisateur (re-import, reprocess), toujours réinitialiser les flags de soft-delete/archivage. Un utilisateur qui ré-importe veut voir le résultat.

## RPC upsert — toujours vérifier les colonnes dans ON CONFLICT UPDATE
**Date** : 2026-03-12
**Contexte** : `upsert_email_matches_with_content` n'updatait pas `is_potential_report` sur les rows existantes.
**Cause** : La colonne manquait dans le `ON CONFLICT DO UPDATE SET`. Le INSERT marchait, mais le UPDATE sur conflit gardait l'ancienne valeur.
**Règle** : Quand on ajoute une colonne à une table avec un upsert RPC, **toujours** ajouter cette colonne dans la clause `DO UPDATE SET`. Vérifier avec `\df+` le code source de la function.

## Trigger.dev exécute le code — pas juste du monitoring
**Date** : 2026-03-12
**Contexte** : Les tasks échouaient avec "Could not resolve authentication method" pour Anthropic et Mistral.
**Cause** : Trigger.dev cloud exécute le code dans ses propres containers. Les env vars du VPS/local ne sont pas disponibles.
**Règle** : Configurer **toutes** les env vars nécessaires dans le dashboard Trigger.dev (Settings > Environment Variables). Ce n'est pas un simple observateur — c'est l'exécutant.

## resolveCompany suppose un profil existant — pas adapté aux emails historiques
**Date** : 2026-03-12
**Contexte** : 100% des emails historiques échouaient avec "Company not found".
**Cause** : `resolveCompany` cherche le sender dans `profiles` pour trouver son workspace, mais les emails historiques viennent de contacts externes sans profil.
**Règle** : Pour les emails historiques où la company est déjà connue (via `email_company_matches`), bypass resolveCompany avec l'option `knownCompany`. Pattern : ajouter des options au pipeline plutôt que modifier la logique core.

## Thread deduplication — constraint uq_report_company_thread
**Date** : 2026-03-12
**Contexte** : 11/32 emails historiques ont échoué avec "duplicate key value violates unique constraint".
**Cause** : Plusieurs emails dans le même thread (Re:, Fwd:) essaient de créer le même report pour la même company.
**Règle** : La constraint `uq_report_company_thread` fait son job — c'est du comportement attendu. Amélioration possible : dédupliquer par `source_thread_id` avant de lancer le pipeline pour éviter du compute inutile.

## Body scoring — éviter les patterns trop génériques
**Date** : 2026-03-12
**Contexte** : 106 potential reports au lieu de ~50-60 attendus.
**Cause** : Patterns trop larges : `\bCA\b` (Chiffre d'Affaires mais aussi initiales), `bonjour à tous`, `objectif/budget/target`, pourcentages seuls, `€\s*\d` (montants à 1 chiffre).
**Règle** : Les regex de scoring doivent être spécifiques au contexte financier/reporting. Tester sur un échantillon réel avant de déployer. Préférer les faux négatifs aux faux positifs pour `is_potential_report`.

## Excel extraction — llmPrompt truthy mais vide de contenu
**Date** : 2026-03-18
**Contexte** : Orus Energy et Jeen avaient raw_content = 36 chars malgré des fichiers Excel avec 86-852 rows.
**Cause** : `parseFinancialData` ne reconnaît que les structures P&L spécifiques (TOTAL REVENUES, EBITDA, etc.). Pour les autres formats, `llmPrompt` contenait seulement le header "## RÉSUMÉ FINANCIER (données Excel)\n" (36 chars). Étant truthy, `llmPrompt || extractedText` ne fallback jamais sur `extractedText`.
**Fix** : Vérifier si `llmPrompt` contient plus que le header. Sinon retourner vide pour forcer le fallback sur le dump brut des cellules.
**Règle** : Toujours tester la condition "contenu utile" plutôt que "truthy" pour les strings qui ont un template/header par défaut.

## Faux reports — le scoring keyword ne suffit pas seul
**Date** : 2026-03-18
**Contexte** : 16 faux reports Little Red Door (emails opérationnels internes, newsletters, reçus) + 2Watch correspondance juridique stockés comme reports investisseurs.
**Cause** : Le scoring keyword (`scoreReportLikelihood`) matche "Reporting semaine 8" (+3 pour "reporting"), "Rapport merci jack clim" (+3 pour "rapport"), etc. Il ne distingue pas reports investisseurs des reports opérationnels internes.
**Fix** : Ajout d'un pré-filtre Haiku dans `processHistoricalReportsTask` entre le fetch email et le pipeline. Haiku classifie : investor_report vs internal_operational/receipt/newsletter/etc. Fail-open (en cas d'erreur Haiku, on laisse passer).
**Règle** : Le scoring keyword est un bon pré-filtre rapide mais ne remplace pas une validation sémantique. Deux couches : regex (élimine 90%), IA (affine les 10% restants).

## Doublons frontend — NULL != NULL dans les contraintes PostgreSQL
**Date** : 2026-03-18
**Contexte** : Castafiore avait 6 reports "January 2025", Adrenalead 2x "April 2025", + ~30 autres doublons.
**Cause** : La contrainte `uq_report_company_thread` sur `(company_id, source_thread_id)` ne protège pas les imports frontend car `source_thread_id` est NULL. PostgreSQL traite `NULL != NULL`, donc la contrainte ne s'applique pas.
**Règle** : Les contraintes unique avec des colonnes nullable ne protègent pas contre les doublons quand la colonne est NULL. Besoin d'un guard applicatif (check company_id + report_period avant INSERT) ou d'un index partiel `WHERE source_thread_id IS NULL`.
