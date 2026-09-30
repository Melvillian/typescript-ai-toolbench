---
name: setup
description: Check prerequisites, tailor the template to this project (prune unneeded apps/packages, rewrite npm scripts and README), install, build, and verify everything works. Use when first cloning the repo or when setup seems broken.
disable-model-invocation: true
---

# Repository Setup

## Your first reply: ask for the repo's intent

Before running any command, reading any file, or saying anything else, your entire first reply is exactly this one line:

> Give a description of the intent of this repo.

No preamble, no plan, no progress report, no suggested answers, no `AskUserQuestion`. End your turn and wait. The user's answer is **the purpose**, used by sections 4–8.

If the user answers that the repo is already set up, use the README intro as the purpose instead.

Once you have the answer, run through each section below in order. For each check, run the command, inspect the output, and report the result to the user. If a check fails, attempt the fix before moving on. If the fix also fails, stop and tell the user what went wrong.

Sections 4–8 tailor the template to this project. They are one-time edits: on a re-run, skip any section whose "already done" check passes.

## 1. Check Node.js

Run `node --version` and verify the major version is >= 22 (as required by the `engines` field in the root package.json).

- **If missing or too old:** Tell the user they need Node >= 22. Suggest installing via `nvm install 22` or downloading from https://nodejs.org. Do NOT install it automatically — just inform the user and stop.

## 2. Check Bun

Run `bun --version` and verify it is installed.

- **If missing:** Ask the user if they'd like you to install Bun by running `curl -fsSL https://bun.sh/install | bash`. If they agree, run it. If they decline, stop and tell them Bun is required.
- **If installed:** Check the version. The repo's `packageManager` field specifies `bun@1.3.14`. Bun **>= 1.3.9** is required (older versions don't order `bun --filter` builds by dependency). If the installed version is older, warn the user and suggest upgrading.

## 3. Update root package.json names

Find all instances of `template-typescript-monorepo` in the repository, and replace them with the name of the repository. Choose the name of the project's root directory, even if it differs from the repository name according to git.

## 4. Record the project's purpose

Sections 5–8 all depend on the purpose the user gave in their first answer.

1. **Already done?** If the README's title and intro already describe this project (not the template — "This is a template for a monorepo..."), a previous `/setup` already tailored the repo. Skip sections 5–8 unless the user asks to re-run them.
2. Set the root `package.json` `description` to the purpose.

## 5. Prune apps and packages this project doesn't need

The template ships demo workspaces. Sort every workspace under `apps/` and `packages/` into exactly one bucket:

- **Keep** — the purpose clearly needs it, or a kept workspace imports it.
- **Remove** — you are _sure_ it isn't needed (rules below). Remove these without asking.
- **Ask** — everything else. When in doubt, it goes here.

### Workspace catalog

| Workspace                    | What it is                                                               | Sure to remove when the purpose...                                                                       |
| ---------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `apps/api`                   | Hono HTTP API on Bun, with a `Dockerfile`. `apps/web` calls it.          | is explicitly something with no server of its own (a CLI tool, a library, a static site with no backend) |
| `apps/web`                   | React 19 + Vite SPA, deploys as a Render static site                     | is explicitly something with no UI (an API-only service, a CLI tool, a library, a bot)                   |
| `apps/cli`                   | Commander CLI                                                            | never sure — always ask, unless the purpose mentions a CLI (then keep)                                   |
| `packages/claude-api`        | Anthropic SDK wrapper (`ANTHROPIC_API_KEY`)                              | names a different LLM provider and not Claude/Anthropic, or clearly involves no LLM at all               |
| `packages/openai-summarizer` | OpenAI summarizer (`OPENAI_API_KEY`)                                     | names a different LLM provider and not OpenAI (e.g. "uses Claude"), or clearly involves no LLM at all    |
| `packages/common-lib`        | Shared utilities (`getEnv`, `toCamelCase`) used by the LLM packages      | never sure — keep if any kept workspace imports it, otherwise ask                                        |
| `generators`                 | Repo tooling (scaffolds Render deploy configs). Not an app or a package. | never — out of scope for pruning                                                                         |

A workspace not in this table was added after the template: read its `package.json`, README, and CLAUDE.md, and put it in **Ask** unless the purpose clearly needs it.

### Rules for "sure"

A workspace is only **Remove** when both hold:

1. The purpose statement explicitly rules it out, per the catalog column above. Silence is not ruling out — "a website for my bakery" says nothing about a CLI, so the CLI goes to **Ask**.
2. No **kept** workspace imports it in source. Check with `grep -rn "<package-name>" apps/*/src packages/*/src generators/src`. A `workspace:*` entry in a `package.json` with no import in source does not count (e.g. `apps/cli` declares `@melvillian/openai-summarizer` but never imports it).

If a workspace fails rule 2 only because a kept workspace imports it, move it to **Ask** and tell the user which code depends on it.

### Present, then remove

1. Tell the user which workspaces you are removing, with a one-line reason each (e.g. "`packages/openai-summarizer` — you said this project uses Claude, not OpenAI"), and that they can be restored from git.
2. For the **Ask** bucket, use `AskUserQuestion` with one question per workspace (options: "Keep" / "Remove", with a description of what the workspace is and what removing it entails). Batch up to 4 questions per call. If the user removes a workspace that kept code imports, ask whether to rewrite that code or keep the workspace — never silently rewrite it.
3. Remove every workspace in the final **Remove** set using the procedure below. Removing a package can leave another package with no importers (e.g. removing both LLM packages orphans `common-lib`); re-apply the rules to what remains until nothing changes.

### Removal procedure

For each removed workspace:

1. `git rm -r <dir>` (or `rm -rf <dir>` if it is untracked).
2. Delete its `"<package-name>": "workspace:*"` entry from every remaining `package.json`.
3. Find the leftovers and fix each hit:
   ```bash
   grep -rn --exclude-dir={node_modules,dist,.git,docs} --exclude=bun.lock -e '<dir>' -e '<package-name>' .
   ```
   Typical hits: root `package.json` scripts (handled in section 6), `README.md`, root `CLAUDE.md` and other workspaces' `CLAUDE.md`/`README.md`, `.claude/skills/*` (including section 14 of this skill), `render.yaml`, `vitest.config.ts`, `eslint.config.js`, `.github/workflows/*`. Leave `docs/` alone — those are dated historical plans and specs.
4. Apply the coupled cleanups that match:
   - **`apps/api` removed, `apps/web` kept:** `apps/web/src/pages/Home.tsx` fetches `/api/hello` as a demo — replace that page with a static starter and rewrite `Home.test.tsx` to match. Remove the `/api` and `/health` proxy from `apps/web/vite.config.ts`, and the "fetch the API by relative path" guidance from `apps/web/CLAUDE.md`. The frontend is now a pure static site: update root `CLAUDE.md`'s Render section and drop any `/api/*` rewrite from `render.yaml`.
   - **`apps/web` removed, `apps/api` kept:** drop the static-site / rewrite guidance from root `CLAUDE.md`'s Render section and `apps/api/CLAUDE.md`, and the `apps/web` entry from `render.yaml`.
   - **Code edited by a cleanup above:** update or delete its tests so `bun run test:coverage` still clears the 95% per-workspace gate (see the `coverage` skill).
   - **An LLM package removed:** remove its API key from `README.md`'s Environment variables and from section 14 of this skill.
   - **`apps/` or `packages/` left empty:** delete the directory and its glob from the root `workspaces` list. In `vitest.config.ts`, remove it from the `['apps', 'packages']` coverage discovery list (it calls `readdirSync` on each, which throws on a missing directory) and from `projects`.
5. Workspaces changed, so `bun.lock` is stale. Section 9's `bun install` rewrites it; the user must commit the new lockfile because CI installs with `--frozen-lockfile`.

## 6. Rewrite the root package.json scripts

Rewrite each root script so it does what the template intended, for the workspaces that actually remain. Rules per script:

| Script                                                                                    | Intent                                                                    | Rewrite rule                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build`, `typecheck`                                                                      | Build / typecheck every workspace in dependency order                     | Keep as-is (`bun --filter '*'` picks up whatever exists). CI runs these — never remove or rename them.                                                                                                                      |
| `dev`                                                                                     | Build packages, then run every dev server concurrently (the full stack)   | `<pkg-build> bun --elide-lines=0 --filter <app> ... dev`, with one `--filter` per remaining **server app** (`api`, `web`, or any app whose `dev` runs a long-lived server). No server apps → delete `dev`.                  |
| `dev:<app>`                                                                               | Build packages, then run one app in dev mode                              | One per remaining app: `<pkg-build> bun --elide-lines=0 --filter <app> dev` for server apps, `... --filter cli start` for the CLI. Delete entries for removed apps.                                                         |
| `start`                                                                                   | Build everything, then run the production-mode full stack                 | `bun run build && bun --elide-lines=0 --filter <app> ... start`, one `--filter` per remaining server app. No server apps → delete `start`.                                                                                  |
| `docker:build:api`, `docker:start:api`                                                    | Build / run the api's Docker image                                        | Keep only if `apps/api/Dockerfile` exists. The image tag is `<root package name>-api`.                                                                                                                                      |
| `clean`, `clean:all`                                                                      | Remove build output (and, for `:all`, `node_modules`) for every workspace | One `dist` glob (and one `node_modules` glob for `:all`) per remaining workspace root: `packages/**`, `apps/**`, and `generators/` (the template omits `generators` — add it). Drop globs whose directory no longer exists. |
| `lint`, `lint:check`, `format`, `test`, `test:watch`, `test:coverage`, `cloc`, `depcheck` | Repo-wide tooling                                                         | Keep as-is. CI runs `test:coverage` and `lint:check`.                                                                                                                                                                       |

`<pkg-build>` is `bun --elide-lines=0 --filter './packages/*' build &&`, so apps can resolve sibling packages' `dist/`. Omit it when `packages/` has no workspaces left.

A root script that doesn't match any row was added after the template: keep it unless it references a removed workspace, file, or script, then ask the user whether to delete or adapt it.

After rewriting, verify every `--filter <name> <script>` in the root scripts names an existing workspace that defines `<script>`. `bun --filter` silently skips workspaces without the script and still exits 0, so a mismatch is invisible otherwise.

## 7. Rewrite each workspace's package.json scripts

For every remaining workspace (`apps/*`, `packages/*`, `generators`):

1. **Required scripts.** Every workspace must define all four, or `bun --filter '*'` silently drops it from the CI gate (see root `CLAUDE.md`):
   ```jsonc
   "build": "tsc",
   "typecheck": "tsc --noEmit",
   "test": "vitest run --root . --passWithNoTests",
   "lint": "eslint src --fix"
   ```
   Add any that are missing, and fix `test`/`lint` variants that don't scope to the workspace (a bare `vitest run` or `eslint .`). Keep a `build` that intentionally differs (e.g. `apps/web`'s `tsc --noEmit && vite build`).
2. **Scripts the root calls.** Each `--filter <this workspace> <script>` in the root scripts must exist here: server apps need `dev` and `start`, the CLI needs `start`.
3. **Stale scripts.** Delete scripts that reference removed workspaces or files that no longer exist. Check that paths in the remaining scripts (e.g. `bin/cli.js`, `dist/main.js`) still resolve.
4. Keep other workspace-specific scripts that still work (`preview`, `build:single`, packages' `dev: tsc --watch`). Don't add scripts nothing calls.

Check for missing required scripts with:

```bash
for f in apps/*/package.json packages/*/package.json generators/package.json; do
  [ -f "$f" ] && node -e 'const p=require(process.argv[1]); const m=["build","typecheck","test","lint"].filter(s=>!p.scripts?.[s]); if (m.length) console.log(p.name, "missing:", m.join(", "))' "./$f"
done
```

No output means every workspace passes.

## 8. Rewrite the README for this project

Rewrite README.md to describe **this** project, as it now stands after sections 5–7.

- Replace the title and intro with the project name (root directory name, as in section 3) and the purpose from section 4.
- Remove template-specific language (e.g. "This is a template...", references to the template author's preferences).
- **Features:** drop entries for removed workspaces and tools.
- **Commands:** regenerate the table from the final root `package.json` scripts — one row per script, no rows for deleted scripts. Update the prose below the table to match (e.g. drop the Docker full-stack paragraph if `apps/api` is gone).
- **Environment variables:** list only variables that a remaining workspace reads.
- Keep the Setup section.

## 9. Install dependencies

Run `bun install` from the repo root. This installs all workspace dependencies (root, apps/_, packages/_), and updates `bun.lock` if section 5 removed workspaces.

- **If it fails:** Show the error output to the user and stop.

## 10. Build all packages and apps

Run `bun run build` from the repo root. This runs `bun --filter '*' build`, which builds every workspace in dependency order automatically (a dependent waits for its dependency).

- **If it fails:** Show the error output. Common causes: missing dependencies (re-run `bun install`), TypeScript errors in source code, or code that still imports a workspace removed in section 5. Help the user diagnose.

## 11. Run type checking

Run `bun run typecheck` to verify all packages and apps pass TypeScript type checking.

- **If it fails:** Show which package(s) failed and the errors. This usually indicates a code issue, not a setup issue — inform the user.

## 12. Run tests

Run `bun run test:coverage`. It runs every test and enforces the 95% per-workspace coverage gate, the same command CI runs.

- **If a coverage threshold fails:** Show which workspace and metric fell short. If section 5 edited that workspace's code, write the missing tests (see the `coverage` skill); otherwise it is a code issue — inform the user.
- **If tests fail:** Show the failing tests. Distinguish between test failures (code issue) and missing test infrastructure (setup issue). If vitest is not found, `bun install` may not have completed correctly.

## 13. Run linter

Run `bun run lint:check` to verify the linter is working.

- **If it fails due to lint errors:** That's fine — the linter works. Tell the user there are lint issues they can fix with `bun run lint`.
- **If it fails due to missing eslint or config issues:** That's a setup problem. Help diagnose.

## 14. Check environment variables

Check for environment variables that workspaces in this repo may need at runtime. Only check variables whose workspace still exists. Do NOT create any files — just warn about what's missing.

**Required env vars to check:**

- None (for now)

**Optional env vars:**

- `RENDER_API_KEY` — Only needed if deploying to Render. Check and note if missing, but don't treat it as blocking.
- `ANTHROPIC_API_KEY` — Used by the `claude-api` package. Check if it is set in the current shell environment. If not, warn the user that they'll need to set it before using any feature that calls Claude.
- `OPENAI_API_KEY` — Used by the `openai-summarizer` package. Check if it is set in the current shell environment. If not, warn the user that they'll need to set it before using any feature that calls OpenAI.

No `.env` is needed to run the API server locally — it defaults to port 8080, which is what the Vite dev proxy targets. `apps/api/.env.example` exists only as a template for overriding `PORT`; mention it to the user only if they want a non-default port (and, if `apps/web` exists, note the Vite proxy in `apps/web/vite.config.ts` must be updated to match).

## 15. Summary

Print a summary table of all checks:

| Step                   | Status            |
| ---------------------- | ----------------- |
| Node.js >= 22          | pass/fail         |
| Bun >= 1.3.9           | pass/fail         |
| Update template name   | pass/fail         |
| Project purpose        | set/skipped       |
| Pruned workspaces      | list removed/none |
| Root scripts           | rewritten/skipped |
| Workspace scripts      | rewritten/skipped |
| README rewritten       | pass/skipped      |
| Dependencies installed | pass/fail         |
| Build                  | pass/fail         |
| Type check             | pass/fail         |
| Tests                  | pass/fail         |
| Linter                 | pass/fail         |
| Environment variables  | pass/warn/ok      |

If section 5 removed anything or sections 6–8 edited files, list the changed files and remind the user to review and commit them (including `bun.lock`).

If everything passed, tell the user they're good to go and remind them of the key commands, taken from the final root `package.json` scripts: `dev`, `dev:<app>`, `start`, and `docker:*` if they exist, plus `test` and `lint`.

---

## Maintaining This Skill

This skill should be updated when the repo's setup requirements change. Common triggers:

- **New runtime dependency added** (e.g., a package starts requiring Redis or Postgres): Add a check in the appropriate section, or add a new section before the summary.
- **New environment variable required**: Add it to section 14. Specify which workspace uses it and whether it's required or optional.
- **Node or Bun version requirement changes**: Update the version check in sections 1 or 2.
- **New workspace package or app added**: add a row to the workspace catalog in section 5 saying what it is and when it is safe to remove. No build-script change is needed — `bun run build` discovers all workspaces. If the new workspace has unique prerequisites (native dependencies, external services), add a check here.
- **New bun script added to root package.json**: add a row to the table in section 6 stating its intent and how to rewrite it when workspaces are removed.
- **New .env.example file added**: Add a check in section 14 to remind users to copy it.

When in doubt, ask: "Would a fresh clone fail or behave unexpectedly without this change in /setup?" If yes, update the skill.
