# web

Minimal Vite + React + TypeScript single-page app. Served in production by
`apps/api` (Express) from this app's `dist/` build output; in dev, Vite's
dev server proxies `/api` and `/health` to Express on :8080.

## Commands (run from repo root)

- `bun run dev` — start Express (:8080) and Vite with HMR (:5173) together
- `bun run dev:web` — Vite dev server alone
- `bun run start` — build everything, serve app + API from Express (:8080)
- `bun --filter web test` — run this app's tests
- `bun --filter web lint` — lint this app

No env setup is needed for `bun run dev` or `bun run start`: the api defaults
to :8080, the port Vite's proxy targets. If you do set a different `PORT` in
`apps/api/.env`, update the proxy targets in `vite.config.ts` to match.

## Structure

- `src/main.tsx` — entrypoint: mounts `<RouterProvider>`
- `src/App.tsx` — layout shell (nav + `<Outlet/>`)
- `src/routes.tsx` — route table: **add new pages here**
- `src/pages/` — one component per route
- `src/index.css` — Tailwind v4 entry (`@import 'tailwindcss'`)

## Extending

- New page: add `src/pages/Foo.tsx`, register it in `src/routes.tsx`, link it
  from `App.tsx`.
- New API call: fetch relative paths (`/api/...`) — same-origin in prod,
  proxied in dev. Add new proxy prefixes in `vite.config.ts` if you add API
  routes outside `/api`.
- State/UI libraries: install into this workspace
  (`cd apps/web && bun add <pkg>`).
