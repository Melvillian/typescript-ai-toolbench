# apps/web — Simple React App Served by apps/api

**Date:** 2026-07-16
**Status:** Approved

## Goal

Add a minimal, extensible React single-page app at `apps/web`, served in
production by the existing Express server in `apps/api`. It is a
create-react-app-style starting point for the monorepo template: small enough
to understand in one sitting, structured so additions (pages, state, component
kits) slot in without restructuring.

The finished work will be manually copied by the repo owner into the original
`template-typescript-monorepo` repo; this repo's implementation must stay
self-contained and produce a file-by-file copy list.

## Decisions (from brainstorming)

| Decision | Choice |
| --- | --- |
| Build tooling | Vite + React + TypeScript (not literal CRA — deprecated) |
| Dev workflow | Vite dev server with proxy to Express; two processes in dev |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite` plugin, no config file) |
| Routing | react-router with 2 example routes + Express SPA fallback |
| Prod serving | Express serves `../../web/dist` by relative path, `WEB_DIST_PATH` env override, graceful API-only fallback if missing |
| Template copy | Manual by owner; deliverable includes copy list |

## apps/web structure

```
apps/web/
├── package.json          # name "web", 4 mandatory scripts + dev/preview
├── tsconfig.json         # follows repo tsconfig patterns, JSX support
├── vite.config.ts        # react + tailwind plugins; /api,/health proxy → :8080
├── index.html            # Vite entry
└── src/
    ├── main.tsx          # ReactDOM.createRoot + RouterProvider
    ├── App.tsx           # layout shell: nav + <Outlet/>
    ├── index.css         # single Tailwind import
    ├── routes.tsx        # route table — the extension point
    └── pages/
        ├── Home.tsx      # fetches GET /api/hello, renders response
        └── About.tsx     # static page proving multi-route works
```

- **Runtime deps:** `react`, `react-dom`, `react-router-dom`.
- **Dev deps:** `vite`, `@vitejs/plugin-react`, `tailwindcss`,
  `@tailwindcss/vite`, `typescript`, `@types/react`, `@types/react-dom`,
  plus test deps (`jsdom`, `@testing-library/react`).
- No state library, no component kit — app-specific additions.
- `routes.tsx` is separate so adding a page = one file in `pages/` + one route
  table line; `App.tsx` stays a pure layout shell.
- `Home.tsx` fetching `/api/hello` proves the web→api wiring in dev (proxy)
  and prod (same origin).

### Scripts (mandatory per apps/CLAUDE.md, plus app-specific)

```jsonc
"scripts": {
  "build": "tsc --noEmit && vite build",
  "typecheck": "tsc --noEmit",
  "test": "vitest run --root . --passWithNoTests",
  "lint": "eslint src --fix",
  "dev": "vite",
  "preview": "vite preview"
}
```

`build` type-checks then bundles (tsc emits nothing; Vite owns emit).

No root eslint config change: the existing typescript-eslint flat config
already parses `.tsx` (its `import/parsers` setting lists `.tsx`), and
`**/vite.config.*` is already in the ignore list. React-specific plugins
(e.g. `eslint-plugin-react-hooks`) are intentionally omitted from the
starter; users add them if wanted.

## apps/api changes (src/main.ts, dotenv dep, .env.example)

1. API routes stay registered first: `/health`, `/api/hello`. The current
   `GET /` JSON endpoint **moves to `/api/info`** — root now serves the app.
2. After API routes: `express.static(webDist)` where
   `webDist = process.env.WEB_DIST_PATH ?? path.resolve(<dir of compiled main.js>, '../../web/dist')`
   resolved via `import.meta.url` (api is ESM).
3. SPA fallback registered last: `app.get('*', ...)` (Express 4 syntax) sends
   `webDist/index.html` so react-router deep links survive refresh.
4. If `webDist` doesn't exist at startup: log a warning and run API-only.
   Deleting `apps/web` from the template must not break api.

## Dev workflow & ports

Single-command flows (bun runs one script across several workspaces
concurrently via repeated `--filter` flags — no `concurrently` dep needed):

- **`bun run dev`** (new root script): builds packages, then
  `bun --filter api --filter web dev` — starts Express (tsx watch, :8080)
  and Vite (HMR, :5173) together with prefixed output.
- **`bun run start`** (new root script): `bun run build && bun --filter api start`
  — production mode locally in one command; Express serves the built web
  app + API on the `.env` port (8080).
- `bun run dev:api` / `bun run dev:web` remain for running either alone.
- Vite proxies `/api` and `/health` to `http://localhost:8080`.
- `apps/api/.env.example` documents `PORT=8080` so dev api runs unprivileged
  (macOS can't bind 80 without root). Docker/prod keeps `PORT=80`.
- Today nothing loads `.env`, so `.env.example` is decorative. Fix: api adds
  the `dotenv` dependency and `import 'dotenv/config'` at the top of
  `main.ts`, loading `apps/api/.env` in every mode. dotenv never overrides
  variables already set in the environment, so Docker's `PORT=80` wins
  (and `.env` is dockerignored anyway).

## Docker / CI

Zero changes. Dockerfile copies the whole tree and `bun run build` builds web
too, so the image serves the web app automatically. CI's
`bun --filter '*'` scripts pick up the new workspace. Verification per
apps/CLAUDE.md: `bun run build && bun run typecheck && bun --filter web test && bun --filter web lint`.

## Testing

- One smoke test in apps/web: `App.test.tsx` renders via vitest + jsdom +
  @testing-library/react — proves the harness, gives users a copyable example.
- api static-serving logic is glue verified through the Docker image /
  manual run; no unit tests added for it.

## Docs to update

- Root `README.md` — features + commands (`dev`, `start`, `dev:web`)
- Root `CLAUDE.md` — commands
- `apps/web/README.md` and `apps/web/CLAUDE.md` — new
- `apps/api/CLAUDE.md` — static serving + `/api/info`
- `.claude/skills/setup/SKILL.md` — key-commands list
- Deliverable: file-by-file copy list for the template repo. `apps/web` never
  references the repo name, so no adaptation is needed when copying.

## Error handling

- Missing web dist → warning + API-only mode (no crash).
- `Home.tsx` renders a visible error state if `/api/hello` fetch fails
  (e.g. Vite dev server running without api) so the starter demonstrates
  fetch error handling.

## Out of scope

- SSR, code splitting, state management, component libraries
- Auth, sessions
- Render deployment changes (existing Docker image just starts serving the app)
