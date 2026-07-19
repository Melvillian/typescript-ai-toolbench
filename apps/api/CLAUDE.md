# API

## Overview

Express HTTP API server. Also serves the built `apps/web` SPA (static files +
SPA fallback) when `apps/web/dist` exists; otherwise runs API-only with a
warning. Part of the monorepo workspace.

## Endpoints

- `GET /health` - Health check
- `GET /api/hello` - Example API endpoint (fetched by apps/web's Home page)
- `GET /api/info` - Service info (moved from `GET /`, which now serves the SPA)
- Unknown `/api/*` paths return `404` with `{ "error": "not found" }` (they do
  NOT fall through to the SPA)
- `GET /*` - Static apps/web assets, falling back to `index.html`

## Configuration

- `PORT` - Listen port (dev: 8080 via `.env`; Docker sets 80)
- `WEB_DIST_PATH` - Override the web app build dir (default: `../../web/dist`
  relative to `src/main.ts` / `dist/main.js`); use an absolute path — a
  relative value resolves against the process cwd, which varies by launch
  style
- `.env` is loaded via dotenv at startup; real environment variables win.

## Commands

- `bun run build` - Compile TypeScript (`tsc`)
- `bun run start` - Run compiled server (`node dist/main.js`)
- `bun run dev` - Dev mode with watch (`tsx watch src/main.ts`)

## Dependencies

- **express** (^4.18.2) - HTTP server framework
- **dotenv** (^16.4.5) - Loads `.env` at startup

## Auto-Update Instructions

After changes to files in this directory, run `/update-claude-md`.
