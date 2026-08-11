# CLAUDE.md

## Overview

TypeScript monorepo using Bun workspaces. Node >=22 required.

- `apps/*` — Thin executable wrappers. Each app's entrypoint should do minimal work: parse CLI args or set up a server, then delegate to a package. Apps should not contain business logic.
- `packages/*` — Importable TypeScript modules containing the actual logic. Each package exposes an interface that the corresponding app depends on and the package implements. There is no standard interface shape; it depends on what the module does.
-  `generators/` — Code generation CLI for scaffolding project files (e.g. Render deploy configs). A workspace like the others, so root `bun install`/`build`/`typecheck
`/`lint`/`test` all cover it.

## Commands

- `bun run build` - Build all packages and apps
- `bun run dev` - Build packages, then start api (:8080) and web dev server with HMR (:5173) together
- `bun run dev:api` - Build packages, then run API server in watch mode
- `bun run dev:cli` - Build packages, then run CLI app
- `bun run dev:web` - Build packages, then run the Vite dev server
- `bun run docker:build:api` - Build the API Docker image (from committed files)
- `bun run docker:start:api` - Run the API Docker image on port 8080
- `bun run start` - Build everything, then run the full stack from prod builds: api (:8080) + web via `vite preview` (:4173, proxies `/api` to the api — the local stand-in for the static site's prod rewrite)
- `bun run test` - Run tests (vitest)
- `bun run test:watch` - Run tests in watch mode
- `bun run test:coverage` - Generate test coverage report
- `bun run lint` - Lint and fix (eslint)
- `bun run lint:check` - Lint check only
- `bun run typecheck` - Typecheck all packages
- `bun run format` - Format code (prettier)
- `bun run clean` - Remove dist dirs
- `bun run clean:all` - Remove dist + node_modules

## Render

- When using the Render MCP, always select this workspace first using `select_workspace` with id `tea-cspvkb8gph6c73ft0hd0`
- **Service naming**: when adding a new service to `render.yaml`, name it `<repository-name>-<app-name>` (e.g. `caroline-nanny-website-api` for `apps/api` in this repo). Render appends its own random suffix to the `.onrender.com` subdomain (e.g. `caroline-nanny-website-api-mvqh.onrender.com`) — do not try to include or control the suffix in `render.yaml`. Generic names like `api` produce unrecognizable domains like `api-mvqh.onrender.com`.
- Exception: the existing `api` service in this repo keeps its name — renaming a service in a blueprint creates a new service rather than renaming the old one. This convention applies to new services and to fresh deploys of repos derived from this template.

### Deploy concepts

- Deploy concepts (static site vs web service decision, blueprint patterns,
  bun requirements, build order) live in the `render-deploys` skill.
- **Static-site-first**: frontend apps deploy as Render static sites by
  default (free, CDN-served). `apps/api` is API-only — it does NOT serve
  `apps/web`; in production the static site's `/api/*` rewrite proxies to the
  api service (hybrid pattern).
