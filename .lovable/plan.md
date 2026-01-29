
## Objectifs (problèmes constatés)
1) Le “scroll” à droite de la sidebar est en réalité le composant **SidebarRail** (`<button data-sidebar="rail" ...>`). Vous ne le voulez pas → on le supprime.
2) Les **coins arrondis du bas** de la zone principale ne sont pas visibles car le layout déborde verticalement (souvent lié à un combo `h-svh` + `md:m-2` + flex scroll sans `min-h-0`) → on verrouille la hauteur correctement et on force le scroll à l’intérieur.
3) Éviter que toute la partie droite (header inclus) “glisse”/déborde : on force **overflow-x hidden** au bon niveau et on garde uniquement le tableau en scroll horizontal (déjà prévu dans `DataTable`).

---

## 1) Supprimer le composant “rail” (et le faux “scrollbar” de la sidebar)
### Changements
- **Fichier**: `src/components/AppSidebar.tsx`
  - Supprimer l’import `SidebarRail`
  - Supprimer `<SidebarRail />` en bas du composant

### Résultat attendu
- Le bouton/rail avec `data-sidebar="rail"` disparaît complètement.
- La sidebar reste ouvrable/fermable uniquement via:
  - le bouton `SidebarTrigger` dans le header
  - le raccourci clavier (Ctrl/Cmd + B)

---

## 2) Fix des 4 coins arrondis visibles (haut + bas) sur `SidebarInset`
### Pourquoi ça arrive
Actuellement `DashboardLayout` impose `h-svh` sur `SidebarInset`, mais `SidebarInset` reçoit aussi (via `src/components/ui/sidebar.tsx`) du style “inset” avec `md:m-2`.
- Sur desktop, `h:100svh` + marges verticales (`m-2` => 0.5rem en haut + 0.5rem en bas) = **débordement vertical**, donc on “perd” le bas (coins arrondis hors écran).
- De plus, dans un layout flex colonne, un enfant scrollable sans `min-h-0` peut forcer le parent à grandir au lieu de scroller.

### Changements (principaux)
- **Fichier**: `src/components/DashboardLayout.tsx`
  1) Mettre la contrainte de hauteur au bon endroit:
     - Appliquer `h-svh overflow-hidden` au wrapper de layout (idéalement sur `SidebarProvider` via `className`, ou au minimum sur un conteneur direct).
  2) Sur `SidebarInset`, remplacer le `h-svh` “brut” par une hauteur qui tient compte des marges en desktop:
     - Exemple: `h-svh md:h-[calc(100svh-1rem)]` (car `m-2` => total vertical 1rem)
  3) Rendre le conteneur scroll vertical “réellement scrollable” sans pousser le parent:
     - Ajouter `min-h-0` sur le bloc `flex-1` qui a `overflow-y-auto`

### Résultat attendu
- La zone principale “inset” tient exactement dans la hauteur visible.
- Les 4 coins arrondis restent visibles (notamment en bas).
- Le scroll vertical se fait **dans le contenu** (pas sur la page entière).

---

## 3) Empêcher le scroll horizontal du layout (header + inset), garder uniquement le tableau scrollable
### État actuel
- `src/components/deals/data-table.tsx` est déjà correct: wrapper `overflow-x-auto` + `Table` en `minWidth: 1100px`.
- Si malgré ça “toute la partie droite” scrolle horizontalement, c’est qu’un parent autorise un débordement X.

### Changements
- **Fichier**: `src/components/DashboardLayout.tsx`
  - Ajouter/renforcer `overflow-x-hidden` sur:
    - `SidebarInset` (ou le conteneur principal)
    - le conteneur scroll vertical (`flex-1 overflow-y-auto`)
- Optionnel (si nécessaire):
  - Ajouter `w-full min-w-0` sur certains wrappers pour éviter qu’un enfant impose une largeur > parent (classique en flex).

### Résultat attendu
- Aucun scroll horizontal “global” sur la partie droite.
- Seul le tableau affiche son propre scroll horizontal.

---

## 4) Checklist de validation (rapide)
1) Aller sur `/opportunities`
2) Vérifier que l’élément `data-sidebar="rail"` n’existe plus dans le DOM
3) Vérifier:
   - sidebar ouverte par défaut
   - toggle via bouton en header OK
4) Descendre dans la page:
   - la page ne doit pas “scroller le body”
   - le contenu scrolle dans la zone centrale
   - les coins arrondis bas restent visibles
5) Vérifier le tableau:
   - scroll horizontal uniquement dans le tableau
   - header ne bouge pas horizontalement

---

## Détails techniques (pour implementation)
- Fichiers modifiés:
  - `src/components/AppSidebar.tsx` (suppression rail)
  - `src/components/DashboardLayout.tsx` (hauteur + overflow + min-h-0)
- Aucun changement requis dans `src/components/ui/sidebar.tsx` pour enlever le rail (puisque c’est `AppSidebar` qui l’instancie), sauf si on veut “désactiver” l’export (pas nécessaire).

