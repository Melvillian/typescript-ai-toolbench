# web

## Overview

Vite + React 19 + TypeScript SPA with react-router and Tailwind CSS v4.
Built to `dist/` and served in production by `apps/api` (Express static +
SPA fallback). In dev, Vite proxies `/api` and `/health` to Express on :8080.

## Commands

- `bun run build` - Type-check (`tsc --noEmit`) then bundle (`vite build`)
- `bun run typecheck` - Type-check only
- `bun run test` - Vitest (jsdom + @testing-library/react)
- `bun run lint` - ESLint with --fix
- `bun run dev` - Vite dev server with HMR (:5173)
- `bun run preview` - Preview the production build

## Conventions

- Add pages in `src/pages/`, register them in `src/routes.tsx`; `App.tsx`
  stays a pure layout shell.
- Fetch APIs by relative path (`/api/...`) so dev proxy and prod same-origin
  both work.
- Standalone `tsconfig.json` (bundler resolution, `noEmit`) — does not extend
  the root NodeNext config, same pattern as `apps/api`.

## Auto-Update Instructions

After changes to files in this directory, run `/update-claude-md`.
