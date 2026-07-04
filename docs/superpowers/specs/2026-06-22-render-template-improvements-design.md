# Design: Template improvements for Render deploys

**Date:** 2026-06-22
**Source:** `render-template-improvements.md` — findings from deploying a real
project that used this repo as a template.

## Goal

Make "deploy an app from this template to Render" fast and reliable on a **clean**
build (Render/CI/Docker all build clean; local dev hides bugs behind stale
`dist/` and host `node_modules`). Every fix lands in **both** the template's
committed artifacts **and** the `render-deploy` generator, so a fresh clone is
correct and re-running the generator stays correct.

## Scope decisions

- **SPA / frontend work is deferred.** This template has no web app (only
  `apps/api` and `apps/cli`). The combined single-origin pattern (§5) and the
  generator `--combined`/SPA option (§2) are **documented only**, not built.
- **Build order is computed, not hardcoded** — so future clones with different
  packages get a correct order automatically.
- **Env helper lives in `common-lib`** and the existing untrimmed readers are
  refactored to use it.
- **Build-order engine is script-driven** (invoked by `/setup` + documented
  re-run on module add), **not** a `postinstall` hook — postinstall would
  rewrite `package.json` on every `bun install` and create noisy churn.
- **`docker:start:api` uses no `--env-file`** because the api has no secrets;
  the `--env-file` pattern is documented for apps that do.

## Current state (verified)

- Root `build`: `bun --filter './packages/*' build && bun --filter './apps/*' build`
  — the packages glob runs `tsc` builds in parallel with no topological order
  (race → `TS2307` on a clean tree).
- `apps/api/Dockerfile` **and** the generator both emit the
  `bun build --compile … --outfile main` → bare `alpine` pattern (unrunnable for
  native addons / runtime file reads).
- Root `.dockerignore` is just `.env` / `.vscode`.
- Generator writes a no-op per-app `apps/<app>/.dockerignore`; `apps/api/.dockerignore` exists.
- `docker:build:api` uses `git archive HEAD | docker build … -` (stdin/tar
  context — `COPY . .` and `.dockerignore` semantics are wrong).
- `packages/claude-api` (`ANTHROPIC_API_KEY`) and `packages/openai-summarizer`
  (`OPENAI_API_KEY`) read `process.env` **untrimmed**.
- `apps/api/src/main.ts` already exposes `GET /health`.
- Workspace package names are unscoped: `api`, `cli`, `common-lib`, `claude-api`,
  `openai-summarizer`.

## Work items

### 1. Computed topological build order (§1)

- **`scripts/gen-build-order.mjs`**: read every `package.json` under
  `packages/*` and `apps/*`; build a dependency graph from cross-workspace deps
  (resolve by workspace package `name`, incl. `workspace:*` specifiers);
  topologically sort (deps before dependents; on ties, packages before apps);
  rewrite the root `build` script to an explicit chain, e.g.
  `bun --filter common-lib build && … && bun --filter api build`.
  - Deterministic tie-breaking (alphabetical within a topo level) so output is
    stable across runs.
  - Detect dependency cycles and fail with a clear message.
  - Idempotent: re-running with no graph change leaves `package.json` byte-identical.
- Add root script `gen:build-order` → `node scripts/gen-build-order.mjs`.
- **`/setup` skill**: add a step after `bun install` and before `bun run build`
  that runs `bun run gen:build-order`. Update the "Maintaining This Skill"
  notes: adding a workspace package/app now requires re-running it.
- **Generator**: add re-running `bun run gen:build-order` to the post-run "next
  steps" output (a new app changes the graph).

### 2. Rewrite the Dockerfile pattern (§2)

Replace the `--compile` Dockerfile in **both** `apps/api/Dockerfile` and the
generator template:

```dockerfile
FROM node:24-bookworm AS builder
RUN npm i -g bun@1.3.3
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build
FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=builder /app /app
ENV NODE_ENV=production PORT=80
EXPOSE 80
CMD ["node", "apps/<app>/dist/main.js"]
```

- Builder is the **full** `node:24-bookworm` (ships a compiler; no `apt`).
- Runtime Node major matches bun's embedded Node (24) for native-addon ABI.
- Run under Node, not a bun-compiled binary. No SPA option (deferred).

### 3. Correct root `.dockerignore`, drop per-app (§3)

- Ship a correct committed root `.dockerignore`:
  `node_modules`, `**/node_modules`, `dist`, `**/dist`, `.git`, `.env`,
  `**/.env`, `.vscode` (plus a comment slot for checked-in dev DB / fixtures).
- Generator **stops emitting** `apps/<app>/.dockerignore` (no-op for a
  root-context build).
- Delete the existing `apps/api/.dockerignore`.

### 4. Fix `docker:*` scripts (§4)

Root `package.json`:

```jsonc
"docker:build:api": "docker build -t <repo>-api -f apps/api/Dockerfile .",
"docker:start:api": "docker run --rm --init -p 8080:80 <repo>-api"
```

- Directory context (`.`) honors `.dockerignore`; replaces the broken
  `git archive | docker build -`.
- The **committed** scripts use the literal current image name
  `template-typescript-monorepo-api`; `/setup`'s existing rename step already
  swaps `template-typescript-monorepo` repo-wide, so no special handling needed.
- No `--env-file` (api has no secrets). Document the
  `--env-file apps/<app>/.env` pattern for apps that need secrets, plus the
  "commit first" caveat (working tree is included in the context).

### 5. Combined single-origin pattern (§5) — deferred

Documented in §8 only. No code, no generator option.

### 6. Richer generated `render.yaml` (§6)

Generator emits, per service:

- `healthCheckPath: /health`.
- A commented `sync: false` secret-key stub with a note that secrets are entered
  in the Render dashboard (encrypted, never in git).
- A comment documenting image-constant env vars (`NODE_ENV`, `PORT`).

Health path default `/health` (matches the api).

### 7. `requireEnv` helper (§7)

- Add to `packages/common-lib` (new `utilities/env.ts`, re-exported from
  `index.ts`):
  - `getEnv(name): string | undefined` — `process.env[name]`, trimmed; returns
    `undefined` if unset or empty after trim.
  - `requireEnv(name): string` — trimmed value, throws a clear error if
    missing/empty.
- Refactor readers to trim, preserving the explicit-override path:
  - `claude-api/callClaude.ts`: `options.apiKey ?? getEnv('ANTHROPIC_API_KEY')`.
  - `openai-summarizer/index.ts`: `validatedOptions.apiKey ?? getEnv('OPENAI_API_KEY')`.
- Add unit tests for `getEnv`/`requireEnv` (trims trailing newline; throws on
  empty).

### 8. Docs (§8)

Document, in README / relevant `CLAUDE.md` / the `generate-render-deploy`
command doc:

- Render Docker vs native runtime: with `env: docker`, build/run come from the
  **Dockerfile** (`RUN`/`CMD`), not `render.yaml` `buildCommand`/`startCommand`.
- bun is mandatory for `workspace:*` installs (npm can't resolve the protocol).
- Service naming: `<repo>-<app>` (Render appends its own subdomain suffix).
- The deferred combined-SPA pattern as a future option, with the CDN-vs-one-origin tradeoff.

### Tests to update

- `generators/src/commands/render-deploy.test.ts`: assert the new Dockerfile
  content (node builder, `bun run build`, `CMD node …`), **no** per-app
  `.dockerignore` is written, and `render.yaml` contains `healthCheckPath: /health`.

## Out of scope

- TypeScript project references / `tsc -b` (the computed build order is the
  chosen fix for §1).
- Building an `apps/web` frontend or any SPA-serving code.
- `postinstall` automation of the build order.
