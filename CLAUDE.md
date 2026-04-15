# Albo Monorepo

## Structure

```
apps/
  web/       → Frontend React+Vite (déployé sur Vercel)
  workers/   → Pipelines Trigger.dev (tasks backend)
  mastra/    → Agents IA Mastra (Mastra Cloud)
```

## Commands

```bash
npm run dev:web        # Dev frontend (localhost:8080)
npm run dev:mastra     # Dev mastra (localhost:4111)
npm run build          # Build all via Turbo
```

## Conventions

- Chaque app a son propre CLAUDE.md avec ses règles spécifiques
- npm workspaces + Turborepo pour l'orchestration
