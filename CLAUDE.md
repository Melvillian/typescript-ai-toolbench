# CLAUDE.md

## Overview

TypeScript monorepo using Bun workspaces. Node >=22 required.

- `apps/*` — Thin executable wrappers. Each app's entrypoint should do minimal work: parse CLI args or set up a server, then delegate to a package. Apps should not contain business logic.
- `packages/*` — Importable TypeScript modules containing the actual logic. Each package exposes an interface that the corresponding app depends on and the package implements. There is no standard interface shape; it depends on what the module does.

## Commands

- `bun run build` - Build all packages and apps
- `bun run dev:cli` - Build packages, then run CLI app
- `bun run dev:api` - Build packages, then run API server in watch mode
- `bun run docker:build:api` - Build the API Docker image (from committed files)
- `bun run docker:start:api` - Run the API Docker image on port 8080
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
