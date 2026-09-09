# CLAUDE.md

TypeScript monorepo template on Bun workspaces (Node >=22, Bun >=1.3.9).
Scripts live in the root `package.json`; the README has the command table.

## Layout

- `apps/*` — thin executables: parse args or start a server, then delegate
  to a package. No business logic.
- `packages/*` — the logic, as importable modules. No standard interface
  shape; each exposes whatever its app needs.
- `generators/` — CLI that scaffolds project files (Render deploy configs).
  A workspace like the others.

## Gotchas

- **`bun --filter '*' <script>` silently skips any workspace that lacks
  `<script>` and still exits 0.** Root `build` and `typecheck` fan out this
  way and CI runs them as blocking jobs, so a workspace missing a script is
  silently excluded from the gate while CI stays green. Every new app or
  package must define all four:

  ```jsonc
  "build": "tsc",
  "typecheck": "tsc --noEmit",
  "test": "vitest run --root . --passWithNoTests",
  "lint": "eslint src --fix"
  ```

  `--root .` and `eslint src` scope to that workspace; `--passWithNoTests`
  keeps `test` green before any tests exist, so keep the script even then.

- Build before typecheck or test. Cross-workspace imports resolve against
  sibling `dist/*.d.ts`, which only exist after `bun run build`. Bun orders
  the build by dependency (that is why Bun >=1.3.9 is required).
- `apps/api` and `apps/web` have standalone `tsconfig.json`s that do not
  extend the root NodeNext config; `packages/*`, `apps/cli`, and `generators`
  extend it.
- Root `bun run test` runs vitest projects from the root; per-workspace
  `test` scripts scope with `--root .`.

## Render

- Name new `render.yaml` services `<repository-name>-<app-name>`. Never
  rename an existing service: renaming creates a new service instead.
- Frontends deploy as static sites by default. `apps/api` is API-only and
  does not serve `apps/web`; in prod the static site's `/api/*` rewrite
  proxies to the api service. The decision heuristic, blueprint patterns,
  and build-order details are in the `render-deploys` skill; scaffold
  entries with `/generate-render-deploy`.

## Skills

- `/setup` — fresh-clone prerequisites, install, build, verify.
- `render-deploys` — everything about deploying to Render.
