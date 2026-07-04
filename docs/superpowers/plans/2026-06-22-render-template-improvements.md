# Render Template Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "deploy an app from this template to Render" reliable on a clean build by fixing the racy build order, the unrunnable Dockerfile, the dockerignore/docker scripts, the bare render.yaml, and untrimmed env reads — in both the committed template and the `render-deploy` generator.

**Architecture:** A deterministic `scripts/gen-build-order.mjs` computes the root `build` script from the workspace dependency graph (topological, stable tie-break), invoked by `/setup` and on module-add. The Dockerfile switches from `bun --compile` to a `node:24-bookworm` builder that runs `bun run build` and a `node:24-bookworm-slim` runtime that runs `node …/dist/main.js`. A `getEnv`/`requireEnv` helper in `common-lib` trims env values; the two API-key readers adopt it.

**Tech Stack:** Bun workspaces, TypeScript, vitest, Commander (generator), Docker, Render.

**Source spec:** `docs/superpowers/specs/2026-06-22-render-template-improvements-design.md`

---

## File Structure

| File                                                              | Responsibility                                                                                   | Task |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---- |
| `scripts/gen-build-order.mjs` (create)                            | Compute + write the topological root `build` script                                              | 1    |
| `scripts/gen-build-order.test.mjs` (create)                       | Unit tests for the pure ordering logic                                                           | 1    |
| `vitest.config.ts` (modify)                                       | Discover `scripts/**/*.test.mjs`                                                                 | 1    |
| `package.json` (modify)                                           | Add `gen:build-order` script; fix `docker:*`; (auto) `build` chain                               | 1, 4 |
| `packages/common-lib/src/utilities/env.ts` (create)               | `getEnv`/`requireEnv` trimmed env helpers                                                        | 2    |
| `packages/common-lib/src/utilities/env.test.ts` (create)          | Tests for the helpers                                                                            | 2    |
| `packages/common-lib/src/index.ts` (modify)                       | Re-export env helpers                                                                            | 2    |
| `packages/claude-api/{package.json,src/callClaude.ts}` (modify)   | Use `getEnv` for `ANTHROPIC_API_KEY`                                                             | 3    |
| `packages/openai-summarizer/{package.json,src/index.ts}` (modify) | Use `getEnv` for `OPENAI_API_KEY`                                                                | 3    |
| `.dockerignore` (modify)                                          | Correct root-context excludes                                                                    | 4    |
| `apps/api/.dockerignore` (delete)                                 | No-op for root-context build                                                                     | 4    |
| `apps/api/Dockerfile` (modify)                                    | New node+bun build/run pattern                                                                   | 5    |
| `generators/src/commands/render-deploy.ts` (modify)               | New Dockerfile template, drop per-app dockerignore, richer render.yaml, gen:build-order reminder | 6    |
| `generators/src/commands/render-deploy.test.ts` (modify)          | Assert new Dockerfile + render.yaml                                                              | 6    |
| `.claude/skills/setup/SKILL.md` (modify)                          | Run `gen:build-order` step + maintaining note                                                    | 7    |
| `.claude/commands/generate-render-deploy.md` (modify)             | Drop per-app dockerignore step, add gen:build-order                                              | 8    |
| `CLAUDE.md` (modify)                                              | Render Docker-vs-native, bun-mandatory, build-order notes                                        | 8    |
| `packages/CLAUDE.md` (modify)                                     | Re-run `gen:build-order` after adding a package                                                  | 8    |

---

## Task 1: Deterministic build-order engine

**Files:**

- Create: `scripts/gen-build-order.mjs`
- Create: `scripts/gen-build-order.test.mjs`
- Modify: `vitest.config.ts`
- Modify: `package.json` (add `gen:build-order` script; `build` value is rewritten by the script)

- [ ] **Step 1: Write the failing test**

Create `scripts/gen-build-order.test.mjs`:

```javascript
import { describe, expect, it } from 'vitest';

import { computeBuildOrder, renderBuildScript } from './gen-build-order.mjs';

const ws = (name, base, deps = [], hasBuild = true) => ({
  name,
  base,
  deps,
  hasBuild,
});

describe('computeBuildOrder', () => {
  it('orders dependencies before dependents', () => {
    const order = computeBuildOrder([
      ws('cli', 'apps', ['@scope/lib']),
      ws('@scope/lib', 'packages', []),
    ]).map((w) => w.name);
    expect(order.indexOf('@scope/lib')).toBeLessThan(order.indexOf('cli'));
  });

  it('puts packages before apps within a level, then alphabetical', () => {
    const order = computeBuildOrder([
      ws('api', 'apps', []),
      ws('@scope/b', 'packages', []),
      ws('@scope/a', 'packages', []),
    ]).map((w) => w.name);
    expect(order).toEqual(['@scope/a', '@scope/b', 'api']);
  });

  it('throws on a dependency cycle', () => {
    expect(() =>
      computeBuildOrder([
        ws('@scope/a', 'packages', ['@scope/b']),
        ws('@scope/b', 'packages', ['@scope/a']),
      ]),
    ).toThrow(/cycle/i);
  });
});

describe('renderBuildScript', () => {
  it('chains filters in order and skips workspaces without a build script', () => {
    const script = renderBuildScript([
      ws('@scope/lib', 'packages', [], true),
      ws('docs', 'apps', [], false),
      ws('api', 'apps', [], true),
    ]);
    expect(script).toBe(
      'bun --filter @scope/lib build && bun --filter api build',
    );
  });
});
```

- [ ] **Step 2: Add the vitest project so the test is discovered**

Modify `vitest.config.ts` — add one inline project to the `projects` array (after the existing `{app,src}` project):

```typescript
      {
        test: {
          include: ['{app,src}/**/*.test.*'],
          environment: 'node',
        },
      },
      {
        test: {
          include: ['scripts/**/*.test.mjs'],
          environment: 'node',
        },
      },
    ],
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun run test`
Expected: FAIL — `Failed to resolve import "./gen-build-order.mjs"` (file does not exist yet).

- [ ] **Step 4: Implement `scripts/gen-build-order.mjs`**

Create `scripts/gen-build-order.mjs`:

```javascript
#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKSPACE_BASES = ['packages', 'apps'];

/**
 * Read every workspace package.json under packages/* and apps/*.
 * @returns {{ name: string, base: string, deps: string[], hasBuild: boolean }[]}
 */
export function collectWorkspaces(rootDir) {
  const workspaces = [];
  for (const base of WORKSPACE_BASES) {
    const baseDir = join(rootDir, base);
    if (!existsSync(baseDir)) continue;
    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgPath = join(baseDir, entry.name, 'package.json');
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (!pkg.name) continue;
      const deps = Object.keys({
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
        ...pkg.optionalDependencies,
      });
      workspaces.push({
        name: pkg.name,
        base,
        deps,
        hasBuild: Boolean(pkg.scripts && pkg.scripts.build),
      });
    }
  }
  return workspaces;
}

/**
 * Deterministic topological sort: dependencies before dependents.
 * Tie-break within a ready frontier: packages before apps, then alphabetical.
 * Throws on a dependency cycle.
 */
export function computeBuildOrder(workspaces) {
  const names = new Set(workspaces.map((w) => w.name));
  const blocking = new Map(
    workspaces.map((w) => [
      w.name,
      new Set(w.deps.filter((d) => names.has(d) && d !== w.name)),
    ]),
  );
  const tieBreak = (a, b) => {
    if (a.base !== b.base) return a.base === 'packages' ? -1 : 1;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  };
  const placed = new Set();
  const ordered = [];
  while (ordered.length < workspaces.length) {
    const ready = workspaces
      .filter((w) => !placed.has(w.name))
      .filter((w) => [...blocking.get(w.name)].every((d) => placed.has(d)))
      .sort(tieBreak);
    if (ready.length === 0) {
      const remaining = workspaces
        .filter((w) => !placed.has(w.name))
        .map((w) => w.name);
      throw new Error(
        `Dependency cycle detected among: ${remaining.join(', ')}`,
      );
    }
    for (const w of ready) {
      ordered.push(w);
      placed.add(w.name);
    }
  }
  return ordered;
}

/** Render the root build script from an ordered workspace list. */
export function renderBuildScript(ordered) {
  return ordered
    .filter((w) => w.hasBuild)
    .map((w) => `bun --filter ${w.name} build`)
    .join(' && ');
}

function main() {
  const rootDir = process.cwd();
  const ordered = computeBuildOrder(collectWorkspaces(rootDir));
  const script = renderBuildScript(ordered);

  const pkgPath = join(rootDir, 'package.json');
  const original = readFileSync(pkgPath, 'utf8');
  const buildRe = /("build":\s*")(?:[^"\\]|\\.)*(")/;
  if (!buildRe.test(original)) {
    throw new Error('No "build" script found in root package.json');
  }
  const updated = original.replace(
    buildRe,
    (_match, p1, p2) => p1 + script + p2,
  );
  if (updated === original) {
    console.log('Build order already up to date.');
    return;
  }
  writeFileSync(pkgPath, updated);
  console.log(`Updated root build order:\n  ${script}`);
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main();
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test`
Expected: PASS — the `computeBuildOrder` and `renderBuildScript` suites are green.

- [ ] **Step 6: Add the `gen:build-order` root script**

Modify `package.json` — add the script directly after the `build` line:

```jsonc
    "build": "bun --filter './packages/*' build && bun --filter './apps/*' build",
    "gen:build-order": "node scripts/gen-build-order.mjs",
```

- [ ] **Step 7: Regenerate the build order for the current graph**

Run: `bun run gen:build-order`
Expected output (current graph — three independent packages, `api`, then `cli`):

```
Updated root build order:
  bun --filter @melvillian/claude-api build && bun --filter @melvillian/common-lib build && bun --filter @melvillian/openai-summarizer build && bun --filter api build && bun --filter cli build
```

Then confirm idempotency — run it again:

Run: `bun run gen:build-order`
Expected: `Build order already up to date.`

- [ ] **Step 8: Verify a clean build is deterministic**

Run: `bun run clean && bun run build`
Expected: build succeeds with no `TS2307: Cannot find module '@melvillian/...'`.

- [ ] **Step 9: Commit**

```bash
git add scripts/gen-build-order.mjs scripts/gen-build-order.test.mjs vitest.config.ts package.json
git commit -m "feat: compute deterministic root build order from workspace graph"
```

---

## Task 2: `getEnv`/`requireEnv` helper in common-lib

**Files:**

- Create: `packages/common-lib/src/utilities/env.ts`
- Create: `packages/common-lib/src/utilities/env.test.ts`
- Modify: `packages/common-lib/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/common-lib/src/utilities/env.test.ts`:

```typescript
import { afterEach, describe, expect, it } from 'vitest';

import { getEnv, requireEnv } from './env.js';

const KEY = 'COMMON_LIB_ENV_TEST';

afterEach(() => {
  delete process.env[KEY];
});

describe('getEnv', () => {
  it('trims surrounding whitespace and newlines', () => {
    process.env[KEY] = '  secret-value\n';
    expect(getEnv(KEY)).toBe('secret-value');
  });

  it('returns undefined when unset', () => {
    expect(getEnv(KEY)).toBeUndefined();
  });

  it('returns undefined when empty after trim', () => {
    process.env[KEY] = '   ';
    expect(getEnv(KEY)).toBeUndefined();
  });
});

describe('requireEnv', () => {
  it('returns the trimmed value', () => {
    process.env[KEY] = ' abc ';
    expect(requireEnv(KEY)).toBe('abc');
  });

  it('throws naming the missing variable', () => {
    expect(() => requireEnv(KEY)).toThrow(/COMMON_LIB_ENV_TEST/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --filter @melvillian/common-lib test`
Expected: FAIL — cannot resolve `./env.js`.

- [ ] **Step 3: Implement the helper**

Create `packages/common-lib/src/utilities/env.ts`:

```typescript
/**
 * Read an environment variable, trimmed. Returns undefined when the variable is
 * unset or empty after trimming. Trimming once here prevents a trailing newline
 * pasted into a dashboard from leaking into an API header (e.g. 401 invalid key).
 */
export function getEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * Like {@link getEnv}, but throws if the variable is missing or empty.
 */
export function requireEnv(name: string): string {
  const value = getEnv(name);
  if (value === undefined) {
    throw new Error(
      `Required environment variable ${name} is missing or empty`,
    );
  }
  return value;
}
```

- [ ] **Step 4: Re-export from the package index**

Modify `packages/common-lib/src/index.ts` — add the export (keep alphabetical with the existing lines):

```typescript
export * from './utilities/env.js';
export * from './utilities/errorToString.js';
export * from './utilities/objectHelpers.js';
export * from './utilities/sleep.js';
export * from './utilities/toCamelCase.js';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun --filter @melvillian/common-lib test`
Expected: PASS — both suites green.

- [ ] **Step 6: Commit**

```bash
git add packages/common-lib/src/utilities/env.ts packages/common-lib/src/utilities/env.test.ts packages/common-lib/src/index.ts
git commit -m "feat(common-lib): add trimmed getEnv/requireEnv helpers"
```

---

## Task 3: Refactor API-key readers to trim via `getEnv`

**Files:**

- Modify: `packages/claude-api/package.json`, `packages/claude-api/src/callClaude.ts`
- Modify: `packages/openai-summarizer/package.json`, `packages/openai-summarizer/src/index.ts`

> Adding `@melvillian/common-lib` as a dependency changes the workspace graph, so this task re-runs `bun run gen:build-order` and re-installs.

- [ ] **Step 1: Add the workspace dependency to both packages**

Both packages already have a `dependencies` block; add `@melvillian/common-lib` as the first entry of each.

Modify `packages/claude-api/package.json` — replace:

```jsonc
  "dependencies": {
    "@anthropic-ai/sdk": "^0.60.0",
    "dotenv": "^16.4.5"
  }
```

with:

```jsonc
  "dependencies": {
    "@melvillian/common-lib": "workspace:*",
    "@anthropic-ai/sdk": "^0.60.0",
    "dotenv": "^16.4.5"
  }
```

Modify `packages/openai-summarizer/package.json` — replace:

```jsonc
  "dependencies": {
    "dotenv": "^16.4.5",
    "openai": "^6.9.1",
    "zod": "^3.22.4"
  }
```

with:

```jsonc
  "dependencies": {
    "@melvillian/common-lib": "workspace:*",
    "dotenv": "^16.4.5",
    "openai": "^6.9.1",
    "zod": "^3.22.4"
  }
```

- [ ] **Step 2: Install so the workspace symlinks exist**

Run: `bun install`
Expected: success; `node_modules/@melvillian/common-lib` symlink resolves in both packages.

- [ ] **Step 3: Refactor `callClaude.ts`**

Modify `packages/claude-api/src/callClaude.ts` — add the import and replace the env read:

Add after the existing imports:

```typescript
import { getEnv } from '@melvillian/common-lib';
```

Replace line 26:

```typescript
const apiKey = options.apiKey ?? process.env['ANTHROPIC_API_KEY'];
```

with:

```typescript
const apiKey = options.apiKey ?? getEnv('ANTHROPIC_API_KEY');
```

- [ ] **Step 4: Refactor `openai-summarizer/index.ts`**

Modify `packages/openai-summarizer/src/index.ts` — add the import near the top (after the `zod` import):

```typescript
import { getEnv } from '@melvillian/common-lib';
```

Replace line 33:

```typescript
const apiKey = validatedOptions.apiKey ?? process.env['OPENAI_API_KEY'];
```

with:

```typescript
const apiKey = validatedOptions.apiKey ?? getEnv('OPENAI_API_KEY');
```

- [ ] **Step 5: Regenerate the build order for the new graph**

Run: `bun run gen:build-order`
Expected output (common-lib now precedes its dependents):

```
Updated root build order:
  bun --filter @melvillian/common-lib build && bun --filter api build && bun --filter @melvillian/claude-api build && bun --filter @melvillian/openai-summarizer build && bun --filter cli build
```

- [ ] **Step 6: Verify clean build, typecheck, and existing tests pass**

Run: `bun run clean && bun run build && bun run typecheck && bun run test`
Expected: all pass — including `packages/claude-api/src/callClaude.test.ts` (it sets `ANTHROPIC_API_KEY = 'test'`, which `getEnv` returns untrimmed-equivalent as `'test'`).

- [ ] **Step 7: Commit**

```bash
git add packages/claude-api packages/openai-summarizer package.json bun.lock
git commit -m "refactor: trim API keys via common-lib getEnv"
```

---

## Task 4: Correct root `.dockerignore`, drop per-app, fix `docker:*` scripts

**Files:**

- Modify: `.dockerignore`
- Delete: `apps/api/.dockerignore`
- Modify: `package.json` (`docker:build:api`, `docker:start:api`)

- [ ] **Step 1: Rewrite the root `.dockerignore`**

Overwrite `.dockerignore` with:

```gitignore
# Build context is the repo root (COPY . .), so this root .dockerignore governs.
node_modules
**/node_modules
dist
**/dist
.git
.env
**/.env
.vscode
coverage
# Add any checked-in dev DB / fixtures here so the image stays clean & ephemeral,
# e.g.:
# **/*.sqlite
```

- [ ] **Step 2: Delete the no-op per-app dockerignore**

Run: `git rm apps/api/.dockerignore`
Expected: file staged for deletion (a per-app `.dockerignore` has no effect on a root-context build).

- [ ] **Step 3: Fix the `docker:*` scripts**

Modify `package.json` — replace the two docker scripts:

```jsonc
    "docker:build:api": "docker build -t template-typescript-monorepo-api -f apps/api/Dockerfile .",
    "docker:start:api": "docker run --rm --init -p 8080:80 template-typescript-monorepo-api",
```

(The literal image name `template-typescript-monorepo-api` is correct for the template; `/setup` rewrites `template-typescript-monorepo` repo-wide on clone. The `.` context — not the old `git archive | docker build -` stdin tar — is what honors `.dockerignore` and mirrors Render. Commit before building, since `.` includes the working tree.)

- [ ] **Step 4: Verify scripts and ignore parse (no Docker needed yet)**

Run: `node -e "const s=require('./package.json').scripts; console.log(s['docker:build:api']); console.log(s['docker:start:api'])"`
Expected: prints the two new commands; neither contains `git archive` or a trailing `-`.

- [ ] **Step 5: Commit**

```bash
git add .dockerignore apps/api/.dockerignore package.json
git commit -m "fix: correct root .dockerignore and docker:* parity scripts"
```

---

## Task 5: Rewrite the committed `apps/api/Dockerfile`

**Files:**

- Modify: `apps/api/Dockerfile`

- [ ] **Step 1: Replace the Dockerfile**

Overwrite `apps/api/Dockerfile` with:

```dockerfile
# Stage 1: Build with the full node image (ships gcc/make/python3 for native
# addons; no apt needed). bun is required to resolve the workspace:* protocol.
FROM node:24-bookworm AS builder

RUN npm i -g bun@1.3.3

WORKDIR /app

# Build context is the repo root (see root .dockerignore).
COPY . .

RUN bun install --frozen-lockfile
RUN bun run build

# Stage 2: Slim runtime. Node major MUST match the builder (ABI) so any native
# addon loads; bun@1.3.3 embeds Node 24.
FROM node:24-bookworm-slim

WORKDIR /app

# Whole tree: node_modules (addons + workspace symlinks), dist, runtime files.
COPY --from=builder /app /app

ENV NODE_ENV=production PORT=80

EXPOSE 80

# Run under Node, not a bun-compiled binary.
CMD ["node", "apps/api/dist/main.js"]
```

- [ ] **Step 2: Commit (the build context includes the working tree, so commit first)**

```bash
git add apps/api/Dockerfile
git commit -m "fix: build/run apps/api under node instead of a bun-compiled binary"
```

- [ ] **Step 3: Build the image**

Run: `bun run docker:build:api`
Expected: image builds; the `RUN bun run build` layer succeeds and produces `apps/api/dist/main.js`.

> If Docker is unavailable in this environment, skip Steps 3–4 and instead verify by inspection: the Dockerfile contains `FROM node:24-bookworm AS builder`, `RUN bun run build`, and `CMD ["node", "apps/api/dist/main.js"]`, and no longer contains `bun build --compile`. Note the skip in the task report.

- [ ] **Step 4: Run the container and hit the health check**

Run (in one shell):

```bash
bun run docker:start:api
```

Run (in another shell):

```bash
curl -s localhost:8080/health
```

Expected: `{"status":"ok","timestamp":"..."}`. Stop the container with Ctrl-C.

---

## Task 6: Update the `render-deploy` generator and its tests

**Files:**

- Modify: `generators/src/commands/render-deploy.ts`
- Modify: `generators/src/commands/render-deploy.test.ts`

- [ ] **Step 1: Write/extend the failing tests**

Modify `generators/src/commands/render-deploy.test.ts` — add an import and two suites. Replace the import line:

```typescript
import { appendToRenderYaml, serviceNameFor } from './render-deploy.js';
```

with:

```typescript
import {
  appendToRenderYaml,
  dockerfileContent,
  serviceNameFor,
} from './render-deploy.js';
```

Add a new suite (anywhere in the file):

```typescript
describe('dockerfileContent', () => {
  it('builds with node + bun and runs under node (no --compile binary)', () => {
    const df = dockerfileContent('api');
    expect(df).toContain('FROM node:24-bookworm AS builder');
    expect(df).toContain('RUN bun run build');
    expect(df).toContain('CMD ["node", "apps/api/dist/main.js"]');
    expect(df).not.toContain('--compile');
  });
});
```

Extend the existing `appendToRenderYaml` "writes a service entry" test — add one assertion inside it:

```typescript
expect(yaml).toContain('healthCheckPath: /health');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd generators && bun run build`
Expected: FAIL — `dockerfileContent` is not exported yet (type error).

(If the build passes for some reason, run `cd generators && bun run test` and expect the new assertions to fail.)

- [ ] **Step 3: Rewrite `render-deploy.ts`**

Modify `generators/src/commands/render-deploy.ts`:

(a) Remove the `.dockerignore` generation. Delete the `generateDockerignore` function entirely and remove its call from the action body, so the action becomes:

```typescript
    try {
      await generateDockerfile(targetPath, appName);
      await appendToRenderYaml(appName, basename(process.cwd()));
```

(b) Replace `generateDockerfile` with a pure content function plus a thin writer:

```typescript
export function dockerfileContent(appName: string): string {
  return `# Stage 1: Build with the full node image (ships gcc/make/python3 for native
# addons; no apt needed). bun is required to resolve the workspace:* protocol.
FROM node:24-bookworm AS builder

RUN npm i -g bun@1.3.3

WORKDIR /app

# Build context is the repo root (see root .dockerignore).
COPY . .

RUN bun install --frozen-lockfile
RUN bun run build

# Stage 2: Slim runtime. Node major MUST match the builder (ABI) so any native
# addon loads; bun@1.3.3 embeds Node 24.
FROM node:24-bookworm-slim

WORKDIR /app

# Whole tree: node_modules (addons + workspace symlinks), dist, runtime files.
COPY --from=builder /app /app

ENV NODE_ENV=production PORT=80

EXPOSE 80

# Run under Node, not a bun-compiled binary.
CMD ["node", "apps/${appName}/dist/main.js"]
`;
}

async function generateDockerfile(basePath: string, appName: string) {
  await writeFile(join(basePath, 'Dockerfile'), dockerfileContent(appName));
  console.log('✓ Created Dockerfile');
}
```

(c) Enrich the render.yaml service entry. In `appendToRenderYaml`, replace the `serviceEntry` template literal with:

```typescript
const serviceEntry = `
  - type: web
    name: ${serviceName}
    env: docker
    autoDeploy: true
    dockerfilePath: apps/${appName}/Dockerfile
    healthCheckPath: /health
    envVars:
      # Image-constant env vars (also baked into the Dockerfile; safe to repeat):
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 80
      # Secrets: declare with \`sync: false\` and enter the value in the Render
      # dashboard (encrypted, never committed). Example:
      # - key: SOME_API_KEY
      #   sync: false
`;
```

(d) Update the action's "Next steps" output. Replace the steps block (the `console.log` calls after the success message) so it reminds the user to regenerate the build order (a new app changes the workspace graph):

```typescript
console.log('\n✓ Render deploy files generated successfully!');
console.log('\nNext steps:');
console.log(
  '1. Regenerate the root build order (a new app changes the graph):',
);
console.log('   bun run gen:build-order');
console.log(
  '2. Create a Blueprint in the Render dashboard pointing to render.yaml',
);
console.log(
  '   (one-time setup: https://dashboard.render.com/select-repo?type=blueprint)',
);
console.log('3. Commit your changes:');
console.log('   git add -A && git commit');
console.log('4. Push to main to deploy:');
console.log('   git push origin main');
```

- [ ] **Step 4: Build and run the generator tests**

Run: `cd generators && bun run build && bun run test`
Expected: PASS — `dockerfileContent`, `serviceNameFor`, and `appendToRenderYaml` (now including `healthCheckPath`) suites are green.

- [ ] **Step 5: Commit**

```bash
git add generators/src/commands/render-deploy.ts generators/src/commands/render-deploy.test.ts
git commit -m "feat(generator): node+bun Dockerfile, richer render.yaml, drop per-app dockerignore"
```

---

## Task 7: Wire `gen:build-order` into the `/setup` skill

**Files:**

- Modify: `.claude/skills/setup/SKILL.md`

- [ ] **Step 1: Insert a build-order step between install and build**

Modify `.claude/skills/setup/SKILL.md` — add a new section immediately after section "## 5. Install dependencies" and before "## 6. Build all packages and apps":

```markdown
## 5b. Generate the deterministic build order

Run `bun run gen:build-order` from the repo root. This reads every workspace's
dependencies and rewrites the root `build` script so packages build in
topological order (dependencies before dependents). Without this, a clean build
can race and fail with `TS2307: Cannot find module '@melvillian/...'`.

- **If it reports "Build order already up to date":** nothing to do.
- **If it updates the order:** the change to `package.json` is expected; it will
  be committed with the rest of the setup changes.
```

- [ ] **Step 2: Add a maintaining-note for new modules**

Modify `.claude/skills/setup/SKILL.md` — in the "## Maintaining This Skill" list, replace the "**New workspace package or app added**" bullet with:

```markdown
- **New workspace package or app added**: `bun install` and `bun run build`
  handle all workspaces via globs, but the root `build` script must build them in
  dependency order. Run `bun run gen:build-order` after adding the module so the
  order is recomputed. If the new package has unique prerequisites (native
  dependencies, external services), add a check here too.
```

- [ ] **Step 3: Verify the skill references a real script**

Run: `node -e "console.log(require('./package.json').scripts['gen:build-order'])"`
Expected: `node scripts/gen-build-order.mjs` (confirms the skill's instruction is runnable).

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/setup/SKILL.md
git commit -m "docs(setup): run gen:build-order during setup and on module add"
```

---

## Task 8: Documentation (concepts + command doc)

**Files:**

- Modify: `.claude/commands/generate-render-deploy.md`
- Modify: `CLAUDE.md`
- Modify: `packages/CLAUDE.md`

- [ ] **Step 1: Update the generate-render-deploy command doc**

Modify `.claude/commands/generate-render-deploy.md` — in the "## Steps" list, replace step 4 (the verify list that mentions `.dockerignore`) with:

```markdown
4. Verify the generated files exist:
   - `apps/$ARGUMENTS.app-name/Dockerfile` (node:24 builder, runs `node …/dist/main.js`)
   - The root `render.yaml` has a new service entry for `$ARGUMENTS.app-name`
     with `healthCheckPath: /health`

   Note: the generator does NOT write a per-app `.dockerignore` — the build
   context is the repo root, so the root `.dockerignore` governs.
```

And replace step 5 with:

```markdown
5. Show the user what was generated and remind them of next steps:
   - Regenerate the root build order (a new app changes the graph): `bun run gen:build-order`
   - If this is the first service in render.yaml, they need a one-time Blueprint
     setup in the Render dashboard
   - Otherwise, just `git push origin main` to deploy
```

- [ ] **Step 2: Add Render concepts to the root CLAUDE.md**

Modify `CLAUDE.md` — append the following at the end of the existing "## Render" section:

```markdown
### Deploy concepts

- **Docker vs native runtime:** services use `env: docker`, so build and run come
  from the **Dockerfile** (`RUN`/`CMD`) — NOT `render.yaml`
  `buildCommand`/`startCommand` (those are native-runtime only). The Dockerfile is
  the single source of truth, giving local == Render parity. Reproduce a Render
  build locally with `bun run docker:build:api` (directory context `.`, so the
  root `.dockerignore` applies — commit first, since the working tree is included).
- **bun is mandatory** in the Dockerfile: npm cannot resolve the `workspace:*`
  protocol. Build with bun, run under Node, and match the runtime Node major to
  bun's embedded Node (bun@1.3.3 → Node 24) for native-addon ABI compatibility.
- **Build order:** the root `build` script is generated by
  `bun run gen:build-order` from the workspace graph. Re-run it whenever you add a
  package or app under `packages/`/`apps/`.
```

- [ ] **Step 3: Add a build-order note to packages/CLAUDE.md**

Modify `packages/CLAUDE.md` — at the end of the "## ✅ Required verification before considering a new package done" section, add:

````markdown
Then regenerate the root build order so the new package builds in dependency
order (otherwise a clean `bun run build` can race):

```bash
bun run gen:build-order
```
````

````

- [ ] **Step 4: Verify the docs reference real commands**

Run: `bun run gen:build-order`
Expected: `Build order already up to date.` (confirms the command referenced throughout the docs works and the tree is in its final state).

- [ ] **Step 5: Commit**

```bash
git add .claude/commands/generate-render-deploy.md CLAUDE.md packages/CLAUDE.md
git commit -m "docs: render docker-vs-native, bun-mandatory, and build-order notes"
````

---

## Final verification

- [ ] Run the full gate from a clean tree:

```bash
bun run clean && bun run build && bun run typecheck && bun run test && bun run lint:check
```

Expected: all pass.

- [ ] Confirm the deferred items are intentionally absent: no `apps/web`, no SPA-serving code, no `--combined` generator flag, no `tsc -b` project references, no `postinstall` hook. These are documented as out-of-scope in the spec.
