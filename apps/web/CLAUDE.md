# CLAUDE.md

## Project Overview

**Albo** is an investment management platform for analyzing deals, portfolios, email, and documents.

- **Stack**: React 18 + TypeScript + Vite + Supabase
- **UI**: shadcn-ui (Radix primitives) + Tailwind CSS
- **Deployment**: Vercel (SPA rewrite in `vercel.json`)

## Commands

```sh
npm run dev        # Dev server at localhost:8080
npm run build      # Production build
npm run build:dev  # Development build
npm run lint       # ESLint
npm run preview    # Preview production build
```

No test framework is configured.

## Project Structure

```
src/
├── components/       # React components
│   ├── ui/           # shadcn-ui base components
│   ├── deals/        # Deal management
│   ├── email/        # Email integration
│   ├── inbox/        # Inbox views
│   ├── portfolio/    # Portfolio tracking
│   └── onboarding/   # Onboarding flows
├── pages/            # Route page components (21 pages)
├── hooks/            # Custom React hooks (~22)
├── contexts/         # AuthContext, WorkspaceContext
├── integrations/     # Supabase client setup
├── lib/              # Utility libraries (emailFormatters, portfolioFormatters, utils)
├── utils/            # Utility functions (memoParser)
├── types/            # TypeScript type definitions
├── config/           # App configuration
├── i18n/             # Internationalization (FR + EN)
├── modules/          # Feature modules (onboarding)
└── assets/           # Static assets
supabase/
├── config.toml       # Supabase project config
└── functions/        # Serverless edge functions
```

## Code Conventions

- **Path alias**: `@/*` maps to `./src/*`
- **TypeScript**: Relaxed — `strictNullChecks: false`, `noImplicitAny: false`, unused vars/params allowed
- **ESLint**: `@typescript-eslint/no-unused-vars` is off; react-hooks and react-refresh plugins enforced
- **Components**: shadcn-ui patterns in `src/components/ui/`; new UI primitives go there
- **Server state**: TanStack React Query
- **Client state**: React Context (auth, workspace)
- **Forms**: React Hook Form + Zod schema validation
- **Dates**: date-fns
- **i18n**: i18next (French + English)
- **Toasts**: Sonner
- **Routing**: React Router DOM v6
- **Charts**: Recharts

## Backend

- **Supabase**: Postgres database, Auth (JWT), Realtime subscriptions
- **Edge functions**: Located in `supabase/functions/` (e.g., `fetch-unipile-emails` for email sync)
