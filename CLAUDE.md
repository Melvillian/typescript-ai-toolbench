# CLAUDE.md

TypeScript monorepo template on Bun workspaces (Node >=22, Bun >=1.3.9).
Scripts live in the root `package.json`; the README has the command table.

## Coverage (required, no one has to ask)

Every workspace must stay at **>= 95% lines, branches, functions, and
statements**. `bun run test:coverage` is the gate (thresholds per workspace in
`vitest.config.ts`); CI runs it as a blocking job and a Stop hook
(`.claude/hooks/coverage-gate.ts`) runs it when you try to end a turn.

- Any code you write or change ships with tests in the same turn. Before
  ending a turn that touched a `src/` directory, run `bun run test:coverage`
  and keep writing tests until it passes. Do not hand back to the user with
  the gate failing, except under the stop-and-ask conditions below.
- **Stop and ask the user** (report current percentages, what is still
  uncovered, and why) instead of continuing when any of these holds:
  1. Coverage tests are costing a large amount of tokens: more effort than
     the change they cover, or more than ~5 write-tests/re-run loops.
  2. Coverage has stalled: two consecutive loops each gained < 1 point on
     the failing metric.
  3. `bun run test:coverage` takes longer than 5 minutes.
- Never buy the number: no `/* v8 ignore */` comments, new `exclude`
  entries, lowered thresholds, or assertion-free tests without the user's
  explicit approval. Unreachable code should be deleted, not ignored.
- Details (single-workspace runs, reading the report, React and CLI test
  patterns, what is excluded and why) are in the `coverage` skill.

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
  `test` scripts scope with `--root .`. Coverage is root-only: the config
  discovers every `apps/*`, `packages/*`, and `generators` directory that has
  a `src/`, so a new workspace is gated automatically.

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
- `coverage` — working the coverage gate: fast loops, test patterns, exclusions.
- `render-deploys` — everything about deploying to Render.
