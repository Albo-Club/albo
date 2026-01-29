

# Plan : Améliorations UX, Performance et Design

## Resume des demandes

1. **Fix scroll Portfolio** : Le scroll vertical n'est pas visible/fonctionnel dans PortfolioTable
2. **Supprimer la pagination** : Afficher toutes les lignes en scroll continu (style Airtable/Excel) avec virtualisation pour la performance
3. **Illustrations gradient** : Ajouter les images gradient avec effet `backdrop-blur-xl` dans certaines cards
4. **Reduire les fonts de 1px** : Ajuster la taille de base des polices

---

## 1. Fix scroll Portfolio et suppression pagination

### Probleme identifie
Dans `PortfolioTable.tsx` :
- Le `maxHeight: "calc(100vh - 400px)"` est fixe dans un style inline
- La pagination est presente mais avec virtualisation, elle est redondante
- Le probleme de scroll vient probablement du fait que le conteneur parent ne passe pas la hauteur correctement

### Solution : Scroll continu sans pagination

Supprimer `getPaginationRowModel` et la section pagination dans les deux tableaux. Utiliser uniquement la virtualisation pour afficher toutes les lignes avec scroll interne.

**Fichier : `src/components/deals/data-table.tsx`**

```typescript
// Supprimer
import { DataTablePagination } from "./data-table-pagination";
getPaginationRowModel: getPaginationRowModel(),

// Garder uniquement
getCoreRowModel: getCoreRowModel(),
getFilteredRowModel: getFilteredRowModel(),
getSortedRowModel: getSortedRowModel(),
getFacetedRowModel: getFacetedRowModel(),
getFacetedUniqueValues: getFacetedUniqueValues(),

// Utiliser table.getRowModel().rows pour toutes les lignes filtrees
const { rows } = table.getRowModel();
```

**Fichier : `src/components/portfolio/PortfolioTable.tsx`**

Meme modification + retirer tout le bloc pagination (lignes 238-291).

### Ajout d'un compteur de resultats

A la place de la pagination, afficher un simple compteur :
```tsx
<div className="shrink-0 flex items-center justify-between px-2 py-2 text-xs text-muted-foreground">
  <span>{table.getFilteredRowModel().rows.length} resultat(s)</span>
</div>
```

---

## 2. Structure de layout pour scroll interne optimal

### Probleme
Le conteneur du tableau doit avoir une hauteur definie pour que le scroll fonctionne. Actuellement, les valeurs `calc(100vh - Xpx)` sont hardcodees et ne s'adaptent pas.

### Solution : Hauteur flexible avec `h-full` et `flex-1`

**Fichier : `src/pages/Dashboard.tsx`**

Wrapper le DataTable dans un conteneur avec hauteur calculee :
```tsx
<div className="flex-1 min-h-0">
  <DataTable columns={columns} data={deals} />
</div>
```

**Fichier : `src/pages/PortfolioPage.tsx`**

Changer le layout global pour utiliser flex column :
```tsx
<div className="flex flex-col h-full space-y-6">
  {/* Header */}
  <div className="shrink-0">...</div>
  
  {/* Stats */}
  <div className="shrink-0">
    <PortfolioStats companies={companies} />
  </div>
  
  {/* Table - prend tout l'espace restant */}
  <div className="flex-1 min-h-0">
    <PortfolioTable data={companies} />
  </div>
</div>
```

**Fichier : `src/components/deals/data-table.tsx` et `src/components/portfolio/PortfolioTable.tsx`**

Remplacer le `maxHeight` inline par une structure flex :
```tsx
<div className="flex flex-col h-full">
  {/* Toolbar - fixe */}
  <div className="shrink-0">
    <DataTableToolbar table={table} />
  </div>
  
  {/* Table scroll */}
  <div className="flex-1 min-h-0 mt-4 overflow-hidden rounded-md border">
    <div
      ref={tableContainerRef}
      className="h-full overflow-y-auto overflow-x-auto scrollbar-none"
    >
      <Table style={{ minWidth: "1100px" }}>
        ...
      </Table>
    </div>
  </div>
  
  {/* Compteur - fixe */}
  <div className="shrink-0 py-2 text-xs text-muted-foreground">
    {table.getFilteredRowModel().rows.length} resultat(s)
  </div>
</div>
```

---

## 3. Illustrations gradient avec backdrop-blur

### Approche
Les images gradient seront utilisees comme fond decoratif dans certaines cards (stats, headers, etc.) avec un overlay `backdrop-blur-xl` pour garder la lisibilite.

### Fichiers a creer

Copier les images dans `src/assets/gradients/` :
- `gradient-orange.png`
- `gradient-purple.png`
- `gradient-green.png`
- `gradient-polar.jpeg`
- `gradient-warm.jpeg`

### Composant reutilisable : `GradientCard`

**Fichier : `src/components/ui/gradient-card.tsx`**

```tsx
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "./card";

type GradientVariant = "orange" | "purple" | "green" | "polar" | "warm";

const gradientImages: Record<GradientVariant, string> = {
  orange: "/assets/gradients/gradient-orange.png",
  purple: "/assets/gradients/gradient-purple.png",
  green: "/assets/gradients/gradient-green.png",
  polar: "/assets/gradients/gradient-polar.jpeg",
  warm: "/assets/gradients/gradient-warm.jpeg",
};

interface GradientCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GradientVariant;
  children: React.ReactNode;
}

export function GradientCard({ 
  variant = "orange", 
  children, 
  className,
  ...props 
}: GradientCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)} {...props}>
      {/* Background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: `url(${gradientImages[variant]})` }}
      />
      
      {/* Blur overlay */}
      <div className="absolute inset-0 backdrop-blur-xl bg-background/60" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </Card>
  );
}
```

### Integration dans PortfolioStats

**Fichier : `src/components/portfolio/PortfolioStats.tsx`**

Utiliser differentes variantes pour chaque stat card :
```tsx
const statVariants: GradientVariant[] = ["orange", "purple", "green", "polar"];

{stats.map((stat, index) => (
  <GradientCard key={stat.label} variant={statVariants[index % 4]}>
    <CardContent className="p-6">
      ...
    </CardContent>
  </GradientCard>
))}
```

---

## 4. Reduire les fonts de 1px

### Approche
Modifier la taille de base dans `index.css` de `16px` a `15px`. Cela impactera toutes les tailles relatives (`rem`, `text-sm`, etc.).

**Fichier : `src/index.css`**

```css
html {
  font-size: 15px;  /* Etait 16px */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### Impact
- `text-sm` (0.875rem) : 14px -> 13.125px
- `text-base` (1rem) : 16px -> 15px
- `text-lg` (1.125rem) : 18px -> 16.875px
- `text-xl` (1.25rem) : 20px -> 18.75px
- `text-2xl` (1.5rem) : 24px -> 22.5px
- `text-3xl` (1.875rem) : 30px -> 28.125px

---

## Recapitulatif des fichiers

| Fichier | Modifications |
|---------|---------------|
| `src/components/deals/data-table.tsx` | Supprimer pagination, ajuster layout flex |
| `src/components/portfolio/PortfolioTable.tsx` | Supprimer pagination, ajuster layout flex |
| `src/pages/PortfolioPage.tsx` | Layout flex pour hauteur dynamique |
| `src/pages/Dashboard.tsx` | Wrapper flex pour DataTable |
| `src/index.css` | font-size: 15px |
| `src/components/ui/gradient-card.tsx` | Nouveau composant |
| `src/components/portfolio/PortfolioStats.tsx` | Utiliser GradientCard |
| `src/assets/gradients/*` | Copier les 5 images |

---

## Performance : Pourquoi cette approche fonctionne

1. **Virtualisation (deja en place)** : `@tanstack/react-virtual` ne rend que les lignes visibles + overscan (5 lignes)
2. **Filtrage cote client** : TanStack Table filtre les 100% des donnees en memoire, tres rapide
3. **Pas de pagination** : Toutes les lignes "existent" mais seules ~15-20 sont dans le DOM
4. **Recherche instantanee** : Le filtre `globalFilter` de TanStack Table est optimise

Avec 70+ elements :
- Sans virtualisation : 70+ TableRow dans le DOM = lent
- Avec virtualisation : ~15-20 TableRow dans le DOM = rapide
- La recherche et les filtres fonctionnent sur les 100% des donnees

