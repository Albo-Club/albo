
# Plan : Mise à jour de la Sidebar et du Layout Principal - Style sidebar-08

## Objectif
Adopter le design "sidebar-08" de shadcn/ui qui propose :
- Une sidebar avec navigation principale collapsible (sous-menus)
- Un conteneur principal `SidebarInset` avec coins arrondis et ombre
- Un header avec breadcrumb et SidebarTrigger
- Une navigation secondaire (Support, Feedback) en bas de la sidebar
- Un profil utilisateur en footer de la sidebar

## Architecture actuelle vs. cible

```text
ACTUELLE:
+------------------+---------------------------+
|     Sidebar      |   Header (h-14, sticky)   |
|  (collapsible)   +---------------------------+
|                  |   Main content            |
|  - Logo/WS       |   (max-w-7xl mx-auto)     |
|  - NavItems      |                           |
|  - UserFooter    |                           |
+------------------+---------------------------+

CIBLE (sidebar-08):
+------------------+----------------------------------+
|     Sidebar      | +------------------------------+ |
|  (collapsible)   | | Header (breadcrumb + trigger)| |
|                  | +------------------------------+ |
|  - TeamSwitcher  | |                              | |
|  - NavMain       | |   SidebarInset               | |
|  - NavProjects   | |   (rounded, shadow)          | |
|  - NavSecondary  | |                              | |
|  - NavUser       | +------------------------------+ |
+------------------+----------------------------------+
```

## Fichiers impactés

### 1. Fichiers à créer

| Fichier | Description |
|---------|-------------|
| `src/components/nav-secondary.tsx` | Navigation secondaire (Support, Feedback) en bas de la sidebar |

### 2. Fichiers à modifier

| Fichier | Modifications |
|---------|---------------|
| `src/components/DashboardLayout.tsx` | Utiliser `SidebarInset` pour le conteneur principal avec coins arrondis |
| `src/components/AppSidebar.tsx` | Restructurer avec NavMain, NavSecondary, NavUser |
| `src/components/nav-main.tsx` | Adapter pour les items avec sous-menus collapsibles |
| `src/components/nav-user.tsx` | Utiliser le pattern shadcn avec dropdown et chevron |

## Plan d'implementation

### Etape 1 : Creer nav-secondary.tsx

Composant simple pour la navigation secondaire (Support, Feedback) :

```typescript
// src/components/nav-secondary.tsx
import { type LucideIcon } from "lucide-react"
import { NavLink } from "react-router-dom"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

interface NavSecondaryProps {
  items: {
    title: string
    url: string
    icon: LucideIcon
  }[]
}

export function NavSecondary({ items, ...props }: NavSecondaryProps) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild size="sm">
                <NavLink to={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
```

### Etape 2 : Modifier nav-main.tsx

Ajouter le support des sous-menus collapsibles avec chevron :

```typescript
// Structure des items avec sous-menus optionnels
interface NavItem {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  items?: {
    title: string
    url: string
  }[]
}
```

Le composant utilisera `Collapsible` pour les items avec sous-menus, avec un chevron qui tourne.

### Etape 3 : Modifier nav-user.tsx

Adapter le NavUser existant pour :
- Utiliser `ChevronsUpDown` au lieu de juste afficher les infos
- Ajouter un dropdown avec options (Profile, Log out)
- Conserver la logique d'authentification existante

### Etape 4 : Modifier AppSidebar.tsx

Restructurer la sidebar pour utiliser :
- `SidebarHeader` avec le WorkspaceDropdown (team switcher)
- `SidebarContent` avec NavMain et NavSecondary
- `SidebarFooter` avec NavUser

Structure finale :

```typescript
<Sidebar variant="inset" collapsible="icon">
  <SidebarHeader>
    <WorkspaceDropdown />
  </SidebarHeader>
  
  <SidebarContent>
    <NavMain items={navMainItems} />
    <NavSecondary items={navSecondaryItems} className="mt-auto" />
  </SidebarContent>
  
  <SidebarFooter>
    <NavUser user={userData} onSignOut={handleSignOut} />
  </SidebarFooter>
</Sidebar>
```

### Etape 5 : Modifier DashboardLayout.tsx

Remplacer le `<main>` actuel par `SidebarInset` :

```typescript
<SidebarProvider defaultOpen={false}>
  <AppSidebar />
  <SidebarInset>
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        {/* Breadcrumb dynamique basee sur la route */}
      </Breadcrumb>
      <div className="ml-auto">
        <AskAIButton />
      </div>
    </header>
    <div className="flex flex-1 flex-col gap-4 p-4">
      {children}
    </div>
  </SidebarInset>
  <AskAISidePanel />
</SidebarProvider>
```

Le `SidebarInset` applique automatiquement les coins arrondis et l'ombre quand la sidebar est en mode "inset".

## Details techniques

### Navigation items

```typescript
const navMainItems = [
  {
    title: "Opportunites",
    url: "/opportunities",
    icon: Target,
    items: [
      { title: "Toutes", url: "/opportunities" },
      { title: "En cours", url: "/opportunities?status=active" },
    ],
  },
  {
    title: "Portfolio",
    url: "/portfolio",
    icon: Wallet,
  },
  {
    title: "Soumettre un deal",
    url: "/submit",
    icon: Plus,
  },
]

const navSecondaryItems = [
  { title: "Support", url: "#", icon: LifeBuoy },
  { title: "Feedback", url: "#", icon: Send },
]
```

### Gestion du collapse

Le mode `collapsible="icon"` est conserve. Quand collapsed :
- Les items affichent uniquement les icones
- Les tooltips s'affichent au hover
- Le rail cliquable permet de re-ouvrir

### Responsive

Sur mobile, la sidebar utilise le mode `Sheet` (drawer) integre au composant `Sidebar` de shadcn/ui.

## Resume des changements

| Action | Fichier | Description |
|--------|---------|-------------|
| Creer | `nav-secondary.tsx` | Navigation secondaire en bas |
| Modifier | `nav-main.tsx` | Ajouter sous-menus collapsibles |
| Modifier | `nav-user.tsx` | Ajouter chevron et dropdown |
| Modifier | `AppSidebar.tsx` | Restructurer avec NavMain/NavSecondary/NavUser |
| Modifier | `DashboardLayout.tsx` | Utiliser SidebarInset + header avec breadcrumb |
