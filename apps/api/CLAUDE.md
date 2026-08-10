# API

## Overview

Hono HTTP API server running on Bun. Routes live in src/app.ts (a runtime-agnostic createApp factory, tested via app.request() under vitest); src/main.ts is the Bun.serve entrypoint. API-only: it does NOT serve `apps/web` — the web app deploys as a Render static site whose `/api/*` rewrite proxies to this service (see the `render-deploys` skill). In dev, Vite's proxy forwards `/api` and `/health` here. Part of the monorepo workspace.

## Endpoints

- `GET /health` - Health check
- `GET /api/hello` - Example API endpoint (fetched by apps/web's Home page)
- `GET /api/info` - Service info
- Unknown `/api/*` paths return `404` with `{ "error": "not found" }`
- All other paths (including `/`) 404 — this service does not serve the web app

## Configuration

- `PORT` - Listen port (dev: 8080 via `.env`; Docker sets 80)
- `.env` is loaded natively by Bun at startup; real environment variables win.

## Commands

- `bun run build` - Compile TypeScript (`tsc`)
- `bun run start` - Run compiled server (`bun dist/main.js`)
- `bun run dev` - Dev mode with watch (`bun --watch src/main.ts`)

## Dependencies

- **hono** (^4.13.1) - HTTP server framework (served via Bun.serve)

## Auto-Update Instructions

After changes to files in this directory, run `/update-claude-md`.
