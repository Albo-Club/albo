# Albo Monorepo

## Structure

```
apps/
  web/       → Frontend React+Vite (déployé sur Vercel)
  workers/   → Pipelines Trigger.dev + Express (PM2)
  mastra/    → Agents IA Mastra (Mastra Cloud)
packages/
  shared/    → Types et utilitaires partagés (@albo/shared)
```

## Commands

```bash
npm run dev:web        # Dev frontend (localhost:8080)
npm run dev:workers    # Dev workers (tsx watch)
npm run dev:mastra     # Dev mastra (localhost:4111)
npm run build          # Build all via Turbo
```

## Conventions

- Chaque app a son propre CLAUDE.md avec ses règles spécifiques
- Le package @albo/shared contient le code partagé entre les apps
- npm workspaces + Turborepo pour l'orchestration
