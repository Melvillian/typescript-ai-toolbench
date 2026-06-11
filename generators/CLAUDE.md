# Generators

## Overview

Code generation tool for scaffolding project files (e.g., Render deploy configs). Built with Commander.js.

## Commands

- `bun run build` - Compile TypeScript
- `bun run dev` - Watch mode compilation
- `bun run typecheck` - Type check without emitting
- `bun run start` - Run generator via `bun bin/generator.js`

## Conventions

- **Render service naming**: the `render-deploy` command names services `<repository-name>-<app-name>` (e.g. `caroline-nanny-website-api`), not the bare app name. The repository name is derived from the basename of the directory the generator is run from (the repo root). Render appends its own random suffix to the `.onrender.com` subdomain, so bare names like `api` yield unrecognizable domains like `api-mvqh.onrender.com`. See `serviceNameFor` in `src/commands/render-deploy.ts`.

## Dependencies

<!-- AUTO-GENERATED - DO NOT EDIT -->

- **commander** (^14.0.2) - CLI argument parsing

## Auto-Update Instructions

After changes to files in this directory, run `/update-claude-md`.
