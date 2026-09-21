---
name: coverage
description: Working the 95% per-workspace coverage gate — running it, fast single-workspace loops, reading the uncovered report, test patterns for Bun packages, CLIs, and React components, what is excluded and why, and when to stop and ask the user. Use when writing or changing any code under a src/ directory, when `bun run test:coverage` or the coverage Stop hook fails, when adding a new app or package, or when tempted to exclude a file or lower a threshold.
---

# Coverage gate

The rule itself (95%, stop-and-ask conditions, no buying the number) lives in
the root `CLAUDE.md`. This skill is the how.

## How the gate is built

- Tool: Vitest + `@vitest/coverage-v8` with AST-aware remapping. One runner
  covers Bun/Node packages (`environment: 'node'`) and React
  (`apps/web`, `environment: 'jsdom'`). It was chosen over
  `@vitest/coverage-istanbul` (same features, slower instrumentation) and
  `bun test --coverage` (no branch coverage, ignores files no test imports,
  one global threshold).
- `vitest.config.ts` discovers every `apps/*`, `packages/*`, and `generators`
  directory with a `src/` and gives each its own 95% threshold on lines,
  branches, functions, and statements, plus a global one. A new workspace is
  gated as soon as it has a `src/`; untested files count as 0%, they do not
  disappear.
- Enforced in three places: `bun run test:coverage` locally, the CI `test`
  job, and the Stop hook `.claude/hooks/coverage-gate.ts` (runs when `src/`
  differs from `main`, 5 minute limit, blocks once per stop attempt).

## The loop

1. `bun run build` once if `dist/` directories are missing or a dependency
   package changed: cross-workspace imports resolve against sibling `dist/`.
2. Iterate on one workspace (about a second):

   ```sh
   COVERAGE_WORKSPACE=packages/common-lib bun run test:coverage packages/common-lib/
   ```

   The env var scopes the report and thresholds; the trailing path scopes
   which test files run. Both are needed.

3. Read the `Uncovered Line #s` column and the `ERROR: Coverage for ...`
   lines. Branches are usually the failing metric: look for `??`, `?:`,
   `||`, default parameters, `catch` blocks, and early returns on those lines.
   `coverage/lcov-report/index.html` shows the exact uncovered branch.
4. Finish with the full gate, `bun run test:coverage`. Only that result counts.

Count your loops. Past ~5, or after two loops that each gained under a point,
or if the full run passes 5 minutes, stop and ask (see `CLAUDE.md`).

## Test patterns used in this repo

Tests sit next to the code as `src/**/*.test.ts(x)`. Copy from these:

- Pure functions: `packages/common-lib/src/math/math.test.ts`.
- SDK clients: mock the SDK module with a class exposing a `vi.fn()`
  (`packages/openai-summarizer/src/index.test.ts`,
  `packages/claude-api/src/callClaude.test.ts`). Reset the mock and clear the
  relevant env vars in `beforeEach`.
- Commander commands: `command.parseAsync(args, { from: 'user' })` with
  `console.log` spied (`apps/cli/src/commands/hello.test.ts`). Commands that
  touch the filesystem run inside a `mkdtemp` directory via `process.chdir`
  (`generators/src/commands/render-deploy.command.test.ts`).
- CLI entry `main()`: mock `createRequire`, `vi.stubGlobal('BUILD_VERSION', …)`,
  and make `process.exit` throw so execution halts like the real thing
  (`apps/cli/src/index.test.ts`).
- React components: Testing Library + `vi.stubGlobal('fetch', …)`; cover
  loading, success, HTTP error, thrown non-`Error`, and resolve/reject after
  unmount (`apps/web/src/pages/Home.test.tsx`). Call `cleanup()` in
  `afterEach`. Routed components render under `createMemoryRouter`
  (`apps/web/src/App.test.tsx`).
- Hono routes: call `app.request(...)` on `createApp()`; no server needed
  (`apps/api/src/app.test.ts`).
- Timers: `vi.useFakeTimers()` + `advanceTimersByTimeAsync`
  (`packages/common-lib/src/utilities/utilities.test.ts`).

Assert behavior. A test that only executes lines to turn them green is
buying the number.

## What is excluded, and the bar for adding more

Excluded today: test files, `*.d.ts`, `src/test/**` setup, and
`apps/*/src/main.{ts,tsx}` (process entrypoints that only start a server or
mount the DOM; importing them has side effects). That last exclusion is only
honest while entrypoints hold no logic, so move logic out of `main.*` into a
tested module (`apps/api/src/app.ts` is the model).

Hard-to-test code is a design signal first: inject the dependency, split the
side effect from the logic, or delete the unreachable branch. If something
still cannot be covered, do not add an exclude, an ignore comment, or a lower
threshold yourself. Stop and ask the user with the specifics.

## New workspace checklist

- `src/` directory with tests beside the code; nothing to register in the
  coverage config.
- The four required scripts from `CLAUDE.md` (`build`, `typecheck`, `test`,
  `lint`).
- A React workspace needs a local vite/vitest config with
  `test.environment: 'jsdom'` (see `apps/web/vite.config.ts`).
