# Express → Hono (Bun runtime) Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Express with Hono in `apps/api` (identical endpoints and behavior), move the server runtime from Node to Bun, and scrub every Express reference from code and docs.

**Architecture:** Split `apps/api/src/main.ts` into `src/app.ts` (a `createApp()` factory returning a Hono app — runtime-agnostic, testable via `app.request()` under vitest/Node) and `src/main.ts` (thin Bun entrypoint: `Bun.serve()`). Static serving uses Hono's runtime-agnostic `hono/serve-static` base with `node:fs` readers (Bun implements `node:fs` natively) — NOT the `hono/bun` adapter, whose handler calls the `Bun` global at request time and would crash the vitest tests, which run under Node. Docker keeps the proven `node:24-bookworm` builder stage (compilers for native addons; node for tsc shebangs; bun for `workspace:*`) and swaps only the runtime stage to `oven/bun:1.3.14-slim`. Migrate incrementally so every commit stays green.

**Tech Stack:** Hono ^4.13.1 (latest as of 2026-08-09), Bun 1.3.14 runtime, @types/bun ^1.3.14, existing toolchain (Bun workspaces, tsc, vitest).

## Why the Bun runtime is safe this time (git-history findings)

The repo previously ran Bun in Docker and retreated to Node. The history:

- `7b6fc3f` (June 2026) adopted **`bun build --compile`** — a single-file executable copied alone into a bare `alpine` image.
- The post-mortem spec `docs/superpowers/specs/2026-06-22-render-template-improvements-design.md` (findings from a real Render deploy) recorded that pattern as "**unrunnable for native addons / runtime file reads**": the compiled binary shipped without `node_modules` (so `.node` native addons couldn't load, on musl to boot) and without any on-disk files the server reads at runtime (e.g. the static web `dist/`).
- `7ee7417` fixed it by abandoning the single-binary: build the whole tree, copy the **whole tree** into the runtime image, run an interpreter against `dist/main.js`. It happened to pick `node` as that interpreter.

The recorded failure was `bun build --compile` + bare image — not the Bun interpreter. This plan keeps the whole-tree-copy pattern and only swaps the interpreter (`node` → `bun`), so neither failure mode can recur. Guardrails preserved: builder and runtime pin the same bun version (1.3.14, embedded Node 24) so any future native addon compiled at install time stays ABI-consistent; `bun build --compile` stays banned (the Dockerfile comment and CLAUDE.md say so explicitly after Task 5).

## Global Constraints

- Hono version: `hono@^4.13.1`. No `@hono/node-server`. Types: `@types/bun@^1.3.14` (devDep).
- Runtime is Bun (`bun dist/main.js` locally, `oven/bun:1.3.14-slim` in Docker). The Docker **builder** stage stays `node:24-bookworm` + `npm i -g bun@1.3.14`. Never use `bun build --compile`.
- `src/app.ts` must stay runtime-agnostic: no `Bun.*` globals, no `hono/bun` imports — vitest runs it under Node. Only `src/main.ts` may touch `Bun.*`.
- At the end, `grep -rniw express` over the repo (excluding `node_modules`, `dist`, `.git`, `bun.lock`) must match **only** `LICENSE` — its "EXPRESS OR IMPLIED" is MIT boilerplate and **must not be edited** — and this plan file. (`eslint.config.js` matches substring greps via "expression"; false positives, do not edit.)
- Endpoint behavior preserved exactly: `GET /health`, `GET /api/hello`, `GET /api/info` return the same JSON; unknown `/api/*` (including `/api` itself) returns `404 {"error":"not found"}`; static `apps/web/dist` serving with `index.html` SPA fallback; API-only mode with `console.warn` when webDist is missing; `PORT` (default 8080) and `WEB_DIST_PATH` keep their semantics; request bodies capped at 10mb (parity with the old `express.json({ limit: '10mb' })`).
- `apps/api/package.json` keeps all four mandatory scripts (`build`, `typecheck`, `test`, `lint`) verbatim per `apps/CLAUDE.md`. `build` stays `tsc`.
- `dotenv` and `tsx` leave `apps/api` (Bun loads `.env` natively — real env vars still win — and `bun --watch` replaces tsx). `dotenv` **stays** in `packages/openai-summarizer`, which is untouched.
- Every commit leaves `bun run build && bun run typecheck && bun run test && bun run lint:check` green from the repo root.

## Reference: current state

`apps/api/src/main.ts` is the only Express code (59 lines: json middleware, 3 GET routes, `/api` 404 catch-all, `express.static` + `app.get('*')` SPA fallback, `app.listen`). Express text references live in: root `CLAUDE.md`, `README.md`, `.claude/skills/setup/SKILL.md`, `docs/superpowers/specs/2026-07-16-web-app-design.md`, `apps/api/{CLAUDE.md,README.md,package.json}`, `apps/web/{README.md,CLAUDE.md,vite.config.ts,src/pages/About.tsx,src/pages/Home.tsx}`. The Dockerfile and root `package.json` have no Express references, but the Dockerfile runtime stage and the generator's Dockerfile template (`generators/src/commands/render-deploy.ts` + its test) run Node and must move to Bun. `apps/api` has no tests today; repo convention is colocated `src/*.test.ts` (picked up by the root `vitest.config.ts` projects glob `{app,src}/**/*.test.*`; `vitest` is hoisted from root devDependencies, so `apps/api` needs no vitest dep).

**Verified against hono@4.13.1 source:** the package exports `hono/serve-static`, a runtime-agnostic middleware taking `getContent(path, c)`, `join`, `isDir`, and `root`; with `path.join` injected, an **absolute** `root` works. On miss it calls `next()`, so a later-registered `app.get('*')` provides the SPA fallback. It resolves `/` → `root` → (isDir) → `root/index.html` with correct mime types, and has a built-in `..`-traversal guard. Hono runs matching handlers in registration order, so API routes registered before the static middleware always win. The `hono/bun` adapter was inspected and rejected: its handler calls `Bun.file` at request time (breaks vitest under Node). `@types/bun@1.3.14` is current and `oven/bun:1.3.14-slim` exists on Docker Hub (both checked 2026-08-09).

---

### Task 1: Hono app factory with API routes (Express untouched)

**Files:**
- Modify: `apps/api/package.json` (add hono; do NOT remove express/tsx/dotenv yet — `src/main.ts` still uses them)
- Create: `apps/api/src/app.ts`
- Test: `apps/api/src/app.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `createApp(options?: { webDist?: string }): Hono` exported from `apps/api/src/app.ts`. Task 2 extends this same function; Task 3's `main.ts` imports it as `import { createApp } from './app.js'`.

- [ ] **Step 1: Add the hono dependency**

In `apps/api/package.json`, change the `dependencies` block to (keep `express` and `dotenv` for now — the old `main.ts` still uses them until Task 3):

```json
"dependencies": {
  "dotenv": "^16.4.5",
  "express": "^4.18.2",
  "hono": "^4.13.1"
},
```

Then run from the repo root:

```bash
bun install
```

Expected: lockfile updated, `hono` resolvable from `apps/api`.

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/app.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

describe('API routes', () => {
  const app = createApp();

  it('GET /health returns ok with a valid timestamp', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; timestamp: string };
    expect(body.status).toBe('ok');
    expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('GET /api/hello returns the greeting', async () => {
    const res = await app.request('/api/hello');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Hello from the api endpoint!' });
  });

  it('GET /api/info returns service metadata', async () => {
    const res = await app.request('/api/info');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      service: 'api',
      version: '1.0.0',
      endpoints: ['/health', '/api/hello', '/api/info'],
    });
  });

  it('unknown /api paths return a JSON 404, not the SPA', async () => {
    for (const p of ['/api', '/api/nope', '/api/nested/deeper']) {
      const res = await app.request(p);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'not found' });
    }
  });

  it('non-API paths 404 when no webDist is configured', async () => {
    const res = await app.request('/about');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
bun --elide-lines=0 --filter api test
```

Expected: FAIL — cannot resolve `./app.js` (module does not exist).

- [ ] **Step 4: Implement the app factory**

Create `apps/api/src/app.ts`:

```ts
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

export interface AppOptions {
  /** Absolute path to the built apps/web SPA; omit to run API-only. */
  webDist?: string;
}

export function createApp(options: AppOptions = {}): Hono {
  const app = new Hono();

  // 10mb body cap — parity with the old express.json({ limit: '10mb' })
  app.use(bodyLimit({ maxSize: 10 * 1024 * 1024 }));

  app.get('/health', (c) =>
    c.json({ status: 'ok', timestamp: new Date().toISOString() })
  );

  app.get('/api/hello', (c) =>
    c.json({ message: 'Hello from the api endpoint!' })
  );

  // Service info (moved from GET / — the root path now serves the web app)
  app.get('/api/info', (c) =>
    c.json({
      service: 'api',
      version: '1.0.0',
      endpoints: ['/health', '/api/hello', '/api/info'],
    })
  );

  // Unknown /api paths are API 404s, not SPA fallthroughs. '/api/*' does not
  // match bare '/api', so register both.
  app.all('/api', (c) => c.json({ error: 'not found' }, 404));
  app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));

  // Task 2 adds static serving + SPA fallback here, gated on options.webDist
  void options;

  return app;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
bun --elide-lines=0 --filter api test
```

Expected: PASS (5 tests).

- [ ] **Step 6: Full green check**

```bash
bun run build && bun run typecheck && bun run lint:check
```

Expected: all pass (Express server still compiles; if `lint:check` flags import order in new files, run `bun run lint` to auto-fix, then re-check).

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json apps/api/src/app.ts apps/api/src/app.test.ts bun.lock
git commit -m "feat(api): add Hono app factory with API routes alongside Express"
```

---

### Task 2: Static web app serving + SPA fallback (runtime-agnostic)

**Files:**
- Modify: `apps/api/src/app.ts` (replace the `void options;` placeholder block)
- Test: `apps/api/src/app.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `createApp(options?: { webDist?: string }): Hono` from Task 1.
- Produces: same signature; when `webDist` (absolute path) is passed, the app serves static files from it and falls back to its `index.html` for non-API GETs. Task 3 relies on exactly this.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/src/app.test.ts` (and extend the top import lines to include the node builtins and `afterAll`):

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { createApp } from './app.js';
```

```ts
describe('static web app serving', () => {
  const webDist = fs.mkdtempSync(path.join(os.tmpdir(), 'api-webdist-'));
  fs.writeFileSync(
    path.join(webDist, 'index.html'),
    '<!doctype html><title>spa-fixture</title>'
  );
  fs.mkdirSync(path.join(webDist, 'assets'));
  fs.writeFileSync(path.join(webDist, 'assets', 'app.js'), 'console.log("hi");');
  const app = createApp({ webDist });

  afterAll(() => {
    fs.rmSync(webDist, { recursive: true, force: true });
  });

  it('serves static files from webDist', async () => {
    const res = await app.request('/assets/app.js');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('console.log("hi");');
  });

  it('serves index.html at the root', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('spa-fixture');
  });

  it('falls back to index.html for react-router paths on refresh', async () => {
    const res = await app.request('/about');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('spa-fixture');
  });

  it('still returns a JSON 404 for unknown /api/* paths', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not found' });
  });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

```bash
bun --elide-lines=0 --filter api test
```

Expected: the 5 Task-1 tests PASS; the 3 static/fallback tests FAIL with 404s (the `/api/nope` one passes — it guards against regression in Step 3).

- [ ] **Step 3: Implement static serving + SPA fallback**

In `apps/api/src/app.ts`, add imports at the top:

```ts
import fs from 'node:fs';
import path from 'node:path';

import { serveStatic } from 'hono/serve-static';
```

and replace the two placeholder lines (`// Task 2 adds ...` and `void options;`) with:

```ts
  // Static web app. Handlers run in registration order, so the API routes
  // above always win; the static middleware calls next() on a miss, landing
  // on the SPA fallback so react-router deep links (e.g. /about) survive a
  // refresh. Uses the runtime-agnostic hono/serve-static base with node:fs
  // readers (Bun implements node:fs natively) — NOT hono/bun's serveStatic,
  // whose handler needs the Bun global and would crash vitest, which runs
  // under Node. With path.join injected, an absolute webDist root is fine.
  if (options.webDist) {
    const webDist = options.webDist;
    app.use(
      '*',
      serveStatic({
        root: webDist,
        join: path.join,
        isDir: async (p) => {
          try {
            return (await fs.promises.stat(p)).isDirectory();
          } catch {
            return false;
          }
        },
        getContent: async (p) => {
          try {
            return await fs.promises.readFile(p);
          } catch {
            return null;
          }
        },
      })
    );
    app.get('*', async (c) =>
      c.html(await fs.promises.readFile(path.join(webDist, 'index.html'), 'utf8'))
    );
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
bun --elide-lines=0 --filter api test
```

Expected: PASS (9 tests).

- [ ] **Step 5: Full green check**

```bash
bun run build && bun run typecheck && bun run lint:check
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/app.ts apps/api/src/app.test.ts
git commit -m "feat(api): serve apps/web static build with SPA fallback from Hono app"
```

---

### Task 3: Bun entrypoint; remove Express, tsx, and dotenv; Bun Docker runtime

**Files:**
- Modify: `apps/api/src/main.ts` (full rewrite, below)
- Modify: `apps/api/package.json` (deps and scripts, below)
- Modify: `apps/api/Dockerfile` (runtime stage only)

**Interfaces:**
- Consumes: `createApp(options?: { webDist?: string }): Hono` from Tasks 1–2.
- Produces: the runnable server (`bun dist/main.js` / `bun --watch src/main.ts` / Docker CMD). No later task consumes code from this one.

- [ ] **Step 1: Rewrite the entrypoint**

Replace the entire contents of `apps/api/src/main.ts` with (this is the ONLY file allowed to touch `Bun.*`; note dotenv is gone — Bun loads `.env` from the cwd natively, and real environment variables still win):

```ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from './app.js';

const PORT = parseInt(process.env.PORT || '8080', 10);

// Static web app (apps/web). Resolved relative to this file so it works both
// compiled (dist/main.js) and in dev (bun --watch src/main.ts) — ../../web/dist
// lands on apps/web/dist either way. Override with WEB_DIST_PATH.
const webDist =
  process.env.WEB_DIST_PATH ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');

const hasWeb = fs.existsSync(webDist);
if (!hasWeb) {
  console.warn(`web dist not found at ${webDist}; running API-only`);
}

const app = createApp(hasWeb ? { webDist } : {});

const server = Bun.serve({ port: PORT, hostname: '0.0.0.0', fetch: app.fetch });
console.log(`Server listening on port ${server.port}`);
```

- [ ] **Step 2: Update dependencies and scripts**

In `apps/api/package.json`, set the scripts and dependency blocks to exactly (the four mandatory scripts are unchanged per `apps/CLAUDE.md`; `start`/`dev` move to bun; express, @types/express, dotenv, and tsx are removed; @types/bun is added for the `Bun` global in main.ts):

```json
"scripts": {
  "build": "tsc",
  "typecheck": "tsc --noEmit",
  "test": "vitest run --root . --passWithNoTests",
  "lint": "eslint src --fix",
  "start": "bun dist/main.js",
  "dev": "bun --watch src/main.ts"
},
"dependencies": {
  "hono": "^4.13.1"
},
"devDependencies": {
  "@types/bun": "^1.3.14",
  "@types/node": "^20.0.0",
  "typescript": "^5.3.3"
}
```

Then run from the repo root:

```bash
bun install
```

Expected: `express`, `@types/express`, `dotenv`, `tsx` gone from `apps/api/node_modules` and pruned from `bun.lock` (verify: `grep -c '"express@' bun.lock` exits non-zero / prints 0 — dotenv stays in the lockfile because `packages/openai-summarizer` still uses it).

- [ ] **Step 3: Swap the Docker runtime stage to Bun**

In `apps/api/Dockerfile`, keep Stage 1 (the `node:24-bookworm` builder — node ships the compilers for native addons and runs tsc's node-shebang bin; bun resolves `workspace:*`) exactly as is, and replace everything from the `# Stage 2:` comment down with:

```dockerfile
# Stage 2: Slim Bun runtime. Same bun version as the builder so any native
# addon compiled during bun install loads against the same embedded Node ABI
# (bun@1.3.14 embeds Node 24).
FROM oven/bun:1.3.14-slim

WORKDIR /app

# Whole tree: node_modules (addons + workspace symlinks), dist, runtime files.
COPY --from=builder /app /app

ENV NODE_ENV=production PORT=80

EXPOSE 80

# Run under Bun as an interpreter — never `bun build --compile`: the
# single-binary pattern shipped without node_modules or on-disk assets and
# broke native addons and runtime file reads (see
# docs/superpowers/specs/2026-06-22-render-template-improvements-design.md).
CMD ["bun", "apps/api/dist/main.js"]
```

- [ ] **Step 4: Full green check**

```bash
bun run build && bun run typecheck && bun run test && bun run lint:check
```

Expected: all pass.

- [ ] **Step 5: Verify the real server end-to-end under Bun**

```bash
bun run start
```

Wait for `Server listening on port 8080`, then in another shell:

```bash
curl -s localhost:8080/health
curl -s localhost:8080/api/hello
curl -s localhost:8080/api/info
curl -s -o /dev/null -w '%{http_code}\n' localhost:8080/api/nope   # expect 404
curl -s localhost:8080/ | head -c 200                              # expect index.html
curl -s localhost:8080/about | head -c 200                         # expect index.html (SPA fallback)
curl -s -o /dev/null -w '%{http_code}\n' localhost:8080/assets/$(ls apps/web/dist/assets | head -1)  # expect 200
```

Expected: JSON bodies matching the old Express responses; SPA fallback works. Also verify `.env` still applies: `apps/api/.env` sets `PORT` — confirm the server came up on that port without dotenv. Stop the server afterward.

- [ ] **Step 6: Verify the Docker image builds and runs under Bun**

```bash
bun run docker:build:api
bun run docker:start:api
```

In another shell: `curl -s localhost:8080/health` → `{"status":"ok",...}` and `curl -s localhost:8080/about | head -c 100` → index.html. Stop the container afterward. (Docker builds from the working tree, so uncommitted changes are included.)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/main.ts apps/api/package.json apps/api/Dockerfile bun.lock
git commit -m "feat(api)!: replace Express with Hono on the Bun runtime"
```

---

### Task 4: Move the generator's Dockerfile template to the Bun runtime

Keeps generated apps consistent with `apps/api/Dockerfile` (the template is a copy of it with the app name interpolated).

**Files:**
- Modify: `generators/src/commands/render-deploy.ts` (the `dockerfileContent` template string)
- Test: `generators/src/commands/render-deploy.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (parallel-safe with Task 5).
- Produces: nothing consumed later; `dockerfileContent(appName)` keeps its existing signature.

- [ ] **Step 1: Update the tests to expect the Bun runtime (failing first)**

In `generators/src/commands/render-deploy.test.ts`, update the two Dockerfile assertions:

```ts
it('builds with node + bun and runs under bun (no --compile binary)', () => {
  const df = dockerfileContent('api');
  expect(df).toContain('FROM node:24-bookworm AS builder');
  expect(df).toContain('RUN bun run build');
  expect(df).toContain('FROM oven/bun:1.3.14-slim');
  expect(df).toContain('CMD ["bun", "apps/api/dist/main.js"]');
  expect(df).not.toContain('--compile');
});

it('interpolates the app name into the CMD path', () => {
  expect(dockerfileContent('worker')).toContain(
    'CMD ["bun", "apps/worker/dist/main.js"]',
  );
});
```

(Keep the surrounding `describe`/imports as they are; only the expectations change.)

- [ ] **Step 2: Run the tests to verify they fail**

```bash
bun --elide-lines=0 --filter generators test
```

Expected: the two updated tests FAIL (template still emits the Node runtime).

- [ ] **Step 3: Update the template**

In `generators/src/commands/render-deploy.ts`, inside `dockerfileContent`, keep the Stage-1 builder lines unchanged and replace the template text from `# Stage 2:` to the end with the same Stage-2 block as `apps/api/Dockerfile` from Task 3 Step 3, but with the CMD interpolated:

```dockerfile
# Stage 2: Slim Bun runtime. Same bun version as the builder so any native
# addon compiled during bun install loads against the same embedded Node ABI
# (bun@1.3.14 embeds Node 24).
FROM oven/bun:1.3.14-slim

WORKDIR /app

# Whole tree: node_modules (addons + workspace symlinks), dist, runtime files.
COPY --from=builder /app /app

ENV NODE_ENV=production PORT=80

EXPOSE 80

# Run under Bun as an interpreter — never `bun build --compile`: the
# single-binary pattern shipped without node_modules or on-disk assets and
# broke native addons and runtime file reads (see
# docs/superpowers/specs/2026-06-22-render-template-improvements-design.md).
CMD ["bun", "apps/${appName}/dist/main.js"]
```

(This lives inside a JS template literal — `${appName}` is the existing interpolation; keep the trailing backtick/newline structure as it is today.)

- [ ] **Step 4: Run the tests to verify they pass**

```bash
bun --elide-lines=0 --filter generators test
```

Expected: PASS.

- [ ] **Step 5: Full green check and commit**

```bash
bun run build && bun run typecheck && bun run test && bun run lint:check
git add generators/src/commands/render-deploy.ts generators/src/commands/render-deploy.test.ts
git commit -m "feat(generator): emit Bun-runtime Dockerfile stage in render-deploy template"
```

---

### Task 5: Scrub Express from docs and copy; document the Bun runtime

No behavior changes — text only (three of the files are `.tsx`/`.ts`, but only comments/JSX copy change). Do **not** touch `LICENSE` or `eslint.config.js` (false-positive matches only), and leave `docs/superpowers/specs/2026-06-22-render-template-improvements-design.md` + its plan untouched — they are the historical record of the bun-compile failure this plan cites. Apply each edit exactly:

**Files (all Modify):**
- `CLAUDE.md` (root) —
  - line 21: `- \`bun run start\` - Build everything, then serve web app + API from Express` → `...from Hono`
  - In "Deploy concepts", replace the **bun is mandatory** bullet with:
    ```markdown
    - **bun is mandatory** in the Dockerfile: npm cannot resolve the `workspace:*`
      protocol. Build in a `node:24-bookworm` image with bun installed (node ships
      the compilers for native addons and runs tsc), then run under Bun
      (`oven/bun:1.3.14-slim`). Builder and runtime pin the same bun version so
      native addons compiled at install time load against the same embedded Node
      ABI (bun@1.3.14 embeds Node 24). Never use `bun build --compile`
      single-binary images — that pattern broke native addons and runtime file
      reads (see docs/superpowers/specs/2026-06-22-render-template-improvements-design.md).
    ```
- `README.md` — line 31: `- Express for the API server` → `- Hono (on the Bun runtime) for the API server`; line 49 table row: `Build everything, serve web app + API from Express` → `...from Hono`
- `.claude/skills/setup/SKILL.md` — line 109: `- \`bun run start\` — Build and serve the web app + API from Express` → `...from Hono`
- `apps/api/CLAUDE.md` —
  - Overview first sentence: `Express HTTP API server.` → `Hono HTTP API server running on Bun. Routes live in src/app.ts (a runtime-agnostic createApp factory, tested via app.request() under vitest); src/main.ts is the Bun.serve entrypoint that resolves webDist.`
  - Configuration: `- \`.env\` is loaded via dotenv at startup; real environment variables win.` → `- \`.env\` is loaded natively by Bun at startup; real environment variables win.`
  - Commands: `- \`bun run start\` - Run compiled server (\`node dist/main.js\`)` → `(\`bun dist/main.js\`)`; `- \`bun run dev\` - Dev mode with watch (\`tsx watch src/main.ts\`)` → `(\`bun --watch src/main.ts\`)`
  - Dependencies: replace the `- **express** ...` and `- **dotenv** ...` bullets with:
    ```markdown
    - **hono** (^4.13.1) - HTTP server framework (served via Bun.serve)
    ```
- `apps/api/README.md` — line 3: `Node.js/Express server` → `Bun/Hono server`; architecture diagram line 13: `Express Server` → `Hono Server (Bun)`
- `apps/web/README.md` — line 4: `(Express)` → `(Hono)`; line 5: `to Express on :8080` → `to Hono on :8080`; line 9: `start Express (:8080)` → `start Hono (:8080)`; line 11: `serve app + API from Express (:8080)` → `...from Hono (:8080)`
- `apps/web/CLAUDE.md` — line 6: `(Express static +` → `(Hono static +`; line 7: `to Express on :8080` → `to Hono on :8080`
- `apps/web/vite.config.ts` — line 8 comment: `Forward API calls to the Express dev server` → `Forward API calls to the Hono dev server`
- `apps/web/src/pages/About.tsx` — `(including the Express SPA fallback` → `(including the Hono SPA fallback`
- `apps/web/src/pages/Home.tsx` — `on the Express` / `server` (spans two JSX lines) → `on the Hono` / `server`
- `docs/superpowers/specs/2026-07-16-web-app-design.md` — historical spec; update it to match reality and note the change:
  - Under `**Status:** Approved` add: `**Updated:** 2026-08-09 — the API server has since been migrated from Express (Node) to Hono (Bun); server references below were updated to match.`
  - Line 9: `the existing Express server` → `the existing Hono server`
  - Line 23: `Vite dev server with proxy to Express` → `Vite dev server with proxy to the API server`
  - Line 25: `2 example routes + Express SPA fallback` → `2 example routes + server SPA fallback`
  - Line 26: `Express serves \`../../web/dist\`` → `The API server serves \`../../web/dist\``
  - Line 82: `After API routes: \`express.static(webDist)\` where` → `After API routes: \`serveStatic({ root: webDist, ... })\` (hono/serve-static) where`
  - Line 85: `\`app.get('*', ...)\` (Express 4 syntax) sends` → `\`app.get('*', ...)\` sends`
  - Line 96: `starts Express (tsx watch, :8080)` → `starts the API server (bun --watch, :8080)`
  - Line 99: `Express serves the built web` → `the API server serves the built web`

- [ ] **Step 1: Apply all edits above**

- [ ] **Step 2: Verify no stray Express references remain**

```bash
grep -rniw express . --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git --exclude=bun.lock
```

Expected: matches ONLY in `./LICENSE` (MIT "EXPRESS OR IMPLIED") and `docs/superpowers/plans/2026-08-09-express-to-hono.md` (this plan, which documents the migration itself). Nothing else.

- [ ] **Step 3: Full green check (web app copy changed, so rebuild)**

```bash
bun run build && bun run typecheck && bun run test && bun run lint:check
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md .claude/skills/setup/SKILL.md apps/api/CLAUDE.md apps/api/README.md apps/web/README.md apps/web/CLAUDE.md apps/web/vite.config.ts apps/web/src/pages/About.tsx apps/web/src/pages/Home.tsx docs/superpowers/specs/2026-07-16-web-app-design.md
git commit -m "docs: replace Express references with Hono; document Bun runtime"
```

---

### Task 6: Final verification sweep

**Files:** none (verification only; commit only if something was missed).

- [ ] **Step 1: Fresh full build from clean state**

```bash
bun run clean && bun install && bun run build && bun run typecheck && bun run test && bun run lint:check
```

Expected: all green.

- [ ] **Step 2: Final Express grep (word-boundary, whole repo)**

```bash
grep -rniw express . --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git
```

Expected: only `./LICENSE` and `docs/superpowers/plans/2026-08-09-express-to-hono.md`. `bun.lock` must NOT appear; if it does, some workspace still declares `express` — run `grep -n express apps/*/package.json packages/*/package.json generators/package.json` to find it, remove it, and re-run `bun install`.

- [ ] **Step 3: Confirm tsx and api-side dotenv are fully gone**

```bash
grep -rn '"tsx"' apps/*/package.json; grep -rn 'dotenv' apps/api
```

Expected: no matches (dotenv remaining in `packages/openai-summarizer` is correct and out of scope).

- [ ] **Step 4: Smoke-test prod mode once more**

```bash
bun run start
```

`curl -s localhost:8080/health && curl -s localhost:8080/about | head -c 100` — expect ok JSON and index.html. Stop the server.

- [ ] **Step 5: Run /update-claude-md**

Per `apps/CLAUDE.md` auto-update instructions, run the `update-claude-md` skill to confirm root, `apps/api`, and `apps/web` CLAUDE.md files accurately reflect the new structure (Task 5 already edited them; this is a consistency check).
