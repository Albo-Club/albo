

# Plan : Améliorations de l'interface et des performances

## Résumé des demandes

1. **Supprimer "Vue d'ensemble"** de la sidebar (actuellement visible pour certains users)
2. **Opportunités : afficher tous les deals du workspace** par défaut (pas seulement ceux de l'utilisateur)
3. **Colonne "Propriétaire"** : afficher un avatar rond avec image ou initiales (comme le profil utilisateur en bas à gauche)
4. **Avatar utilisateur en rond** (pas carré avec radius) - garder le carré pour le logo workspace
5. **Scroll vertical à l'intérieur des tableaux** pour garder la pagination visible
6. **Lazy loading / virtualisation** pour gérer 70+ éléments sans problème de performance

---

## 1. Supprimer "Vue d'ensemble" de la sidebar

### Fichier : `src/components/AppSidebar.tsx`

Supprimer le code qui ajoute conditionnellement "Vue d'ensemble" pour les FLAGGED_USERS.

Avant :
```typescript
const navMainItems = [
  ...(canSeeDashboard ? [{
    title: "Vue d'ensemble",
    url: "/dashboard",
    icon: Home,
  }] : []),
  ...
];
```

Après :
```typescript
const navMainItems = [
  {
    title: "Opportunités",
    url: "/opportunities",
    icon: Target,
  },
  {
    title: "Portfolio",
    url: "/portfolio",
    icon: Wallet,
  },
];
```

Supprimer également les imports `Home` et la constante `FLAGGED_USERS` si elle n'est plus utilisée.

---

## 2. Opportunités : afficher tous les deals du workspace par défaut

### Fichier : `src/pages/Dashboard.tsx`

Actuellement, le code récupère les deals différemment selon `isPersonalMode`. Pour simplifier et afficher tous les deals du workspace par défaut :

Modifier la logique de `fetchDeals` pour que :
- En mode **workspace** (isPersonalMode = false), on récupère **tous les deals du workspace** via `get_workspace_deals`
- En mode **personnel** (isPersonalMode = true), on garde le comportement actuel (deals de l'utilisateur uniquement)

Le code actuel fait déjà ça mais il faut aussi inclure `avatar_url` dans la requête pour l'avatar du propriétaire.

**Changement dans la requête** :
```typescript
owner:profiles!deals_user_id_fkey(id, name, email, avatar_url)
```

---

## 3. Colonne "Propriétaire" avec avatar rond

### Fichier : `src/components/deals/columns.tsx`

Modifier la colonne `ownerName` pour afficher un `Avatar` avec :
- Image si `owner.avatar_url` existe
- Initiales sinon (comme NavUser)

**Avant** :
```tsx
cell: ({ row }) => {
  const ownerName = row.getValue("ownerName") as string;
  const owner = row.original.owner;
  return (
    <button ... className="text-sm text-muted-foreground ...">
      {ownerName || "—"}
    </button>
  );
}
```

**Après** :
```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

cell: ({ row }) => {
  const owner = row.original.owner;
  const ownerName = owner?.name || owner?.email || "Inconnu";
  
  const getInitials = () => {
    if (owner?.name) {
      return owner.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return owner?.email?.[0]?.toUpperCase() || "?";
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={...} className="...">
          <Avatar className="h-7 w-7">
            {owner?.avatar_url && (
              <AvatarImage src={owner.avatar_url} alt={ownerName} />
            )}
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        </button>
      </TooltipTrigger>
      <TooltipContent>{ownerName}</TooltipContent>
    </Tooltip>
  );
}
```

**Mise à jour de l'interface Deal** :
```typescript
owner?: {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;  // Ajouter ce champ
} | null;
```

---

## 4. Avatar utilisateur rond (sidebar) vs logo workspace carré

### Fichier : `src/components/nav-user.tsx`

L'avatar est déjà configuré avec `rounded-lg` (carré arrondi). Le changer en `rounded-full` :

```tsx
<Avatar className="h-8 w-8">  {/* Supprimer rounded-lg */}
  <AvatarFallback className="bg-primary/10 text-primary text-xs">
    {getInitials()}
  </AvatarFallback>
</Avatar>
```

Note : Le composant `Avatar` par défaut utilise `rounded-full` (voir `src/components/ui/avatar.tsx` ligne 13).

### Fichier : `src/components/WorkspaceDropdown.tsx`

Garder le logo workspace avec `rounded-md` (carré arrondi) :
```tsx
<div className="h-8 w-8 rounded-md bg-primary/10 ...">
```
(C'est déjà le cas, rien à changer)

---

## 5. Scroll vertical à l'intérieur des tableaux

### Objectif
Le tableau doit scroller verticalement de manière indépendante, avec la pagination toujours visible en bas.

### Fichier : `src/components/deals/data-table.tsx`

Restructurer le layout :

```tsx
<div className="flex flex-col h-full">
  {/* Toolbar - fixe en haut */}
  <DataTableToolbar table={table} />
  
  {/* Table avec scroll vertical */}
  <div className="flex-1 min-h-0 mt-4 overflow-hidden rounded-md border">
    <div className="h-full overflow-y-auto overflow-x-auto">
      <Table style={{ minWidth: '1100px' }}>
        {/* ... */}
      </Table>
    </div>
  </div>
  
  {/* Pagination - fixe en bas */}
  <div className="mt-4 shrink-0">
    <DataTablePagination table={table} />
  </div>
</div>
```

### Fichiers : `src/pages/Dashboard.tsx` et `src/pages/PortfolioPage.tsx`

Passer une hauteur maximale au conteneur du tableau pour qu'il puisse calculer son scroll :

```tsx
<div className="h-[calc(100vh-250px)]">
  <DataTable columns={columns} data={deals} />
</div>
```

### Fichier : `src/components/portfolio/PortfolioTable.tsx`

Appliquer la même structure avec scroll interne.

---

## 6. Performance : Lazy loading avec virtualisation

### Problème actuel
TanStack Table avec pagination charge 100% des données côté client. Avec 70+ éléments, le rendu initial peut être lent.

### Solution recommandée : TanStack Virtual

Installer `@tanstack/react-virtual` pour virtualiser les lignes du tableau :

**Package à ajouter** : `@tanstack/react-virtual`

### Implémentation dans `data-table.tsx`

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

// Dans le composant :
const tableContainerRef = React.useRef<HTMLDivElement>(null);

const rowVirtualizer = useVirtualizer({
  count: table.getRowModel().rows.length,
  estimateSize: () => 52, // hauteur estimée d'une ligne
  getScrollElement: () => tableContainerRef.current,
  overscan: 5, // lignes pré-rendues hors écran
});

// Dans le rendu :
<div ref={tableContainerRef} className="h-full overflow-y-auto ...">
  <Table>
    <TableBody>
      <tr style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        <td style={{ position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = table.getRowModel().rows[virtualRow.index];
            return (
              <TableRow
                key={row.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                  width: '100%',
                }}
              >
                {/* cells */}
              </TableRow>
            );
          })}
        </td>
      </tr>
    </TableBody>
  </Table>
</div>
```

### Filtres et recherche

La virtualisation fonctionne **après** le filtrage de TanStack Table, donc :
- Les filtres s'appliquent sur **100% des données**
- Seules les lignes visibles (+ overscan) sont rendues dans le DOM
- La recherche reste instantanée car TanStack Table filtre en mémoire

---

## Récapitulatif des fichiers à modifier

| Fichier | Modifications |
|---------|---------------|
| `src/components/AppSidebar.tsx` | Supprimer "Vue d'ensemble" et FLAGGED_USERS |
| `src/pages/Dashboard.tsx` | Ajouter `avatar_url` dans la requête profiles |
| `src/components/deals/columns.tsx` | Remplacer texte par Avatar rond avec tooltip |
| `src/components/nav-user.tsx` | Avatar rond (supprimer `rounded-lg`) |
| `src/components/deals/data-table.tsx` | Restructurer layout + ajouter virtualisation |
| `src/components/portfolio/PortfolioTable.tsx` | Même structure de scroll + virtualisation |
| `package.json` | Ajouter `@tanstack/react-virtual` |

---

## Ordre d'implémentation suggéré

1. Supprimer "Vue d'ensemble" de la sidebar
2. Modifier les requêtes pour inclure `avatar_url`
3. Mettre à jour la colonne Propriétaire avec Avatar
4. Corriger les avatars (rond pour user, carré pour workspace)
5. Restructurer les tableaux pour le scroll interne
6. Ajouter la virtualisation pour les performances

