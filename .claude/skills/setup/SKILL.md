---
name: setup
description: Check prerequisites, install dependencies, build the repo, and verify everything works. Use when first cloning the repo or when setup seems broken.
disable-model-invocation: true
---

# Repository Setup

Run through each section below in order. For each check, run the command, inspect the output, and report the result to the user. If a check fails, attempt the fix before moving on. If the fix also fails, stop and tell the user what went wrong.

## 1. Check Node.js

Run `node --version` and verify the major version is >= 22 (as required by the `engines` field in the root package.json).

- **If missing or too old:** Tell the user they need Node >= 22. Suggest installing via `nvm install 22` or downloading from https://nodejs.org. Do NOT install it automatically — just inform the user and stop.

## 2. Check Bun

Run `bun --version` and verify it is installed.

- **If missing:** Ask the user if they'd like you to install Bun by running `curl -fsSL https://bun.sh/install | bash`. If they agree, run it. If they decline, stop and tell them Bun is required.
- **If installed:** Check the version. The repo's `packageManager` field specifies `bun@1.3.14`. Bun **>= 1.3.9** is required (older versions don't order `bun --filter` builds by dependency). If the installed version is older, warn the user and suggest upgrading.

## 3. Update root package.json names

Find all instances of `template-typescript-monorepo` in the repository, and replace them with the name of the repository. Choose the name of the project's root directory, even if it differs from the repository name according to git.

## 4. Rewrite the README for this project

The README.md still describes the template this repo was created from ("This is a template for a monorepo..."). Rewrite it to describe **this** project.

1. **Check whether this is still needed:** If the README's title and intro already describe this project (not the template), report "already done" and skip to the next step.
2. **Determine the project name:** Use the project's root directory name (same convention as step 3).
3. **Determine the project's purpose:** Ask the user for a one-to-two sentence explanation of what this project is for. You should almost always ask — only skip asking when the root directory name makes the purpose unambiguous (e.g. `caroline-nanny-website` is obviously a website for a nanny named Caroline). A name like `my-tools` or `acme-monorepo` is NOT obvious — ask.
4. **Rewrite README.md:**
   - Replace the title and intro with the project name and purpose.
   - Remove template-specific language (e.g. "This is a template...", references to the template author's preferences).
   - Keep the Setup, Commands, and Environment variables sections — they describe this repo's mechanics and remain accurate. Keep the Features section only if it still reflects what the project uses; trim entries that don't apply.

## 5. Install dependencies

Run `bun install` from the repo root. This installs all workspace dependencies (root, apps/_, packages/_).

- **If it fails:** Show the error output to the user and stop.

## 6. Build all packages and apps

Run `bun run build` from the repo root. This runs `bun --filter '*' build`, which builds every workspace in dependency order automatically (a dependent waits for its dependency).

- **If it fails:** Show the error output. Common causes: missing dependencies (re-run `bun install`), TypeScript errors in source code. Help the user diagnose.

## 7. Run type checking

Run `bun run typecheck` to verify all packages and apps pass TypeScript type checking.

- **If it fails:** Show which package(s) failed and the errors. This usually indicates a code issue, not a setup issue — inform the user.

## 8. Run tests

Run `bun run test` to execute the test suite.

- **If it fails:** Show the failing tests. Distinguish between test failures (code issue) and missing test infrastructure (setup issue). If vitest is not found, `bun install` may not have completed correctly.

## 9. Run linter

Run `bun run lint:check` to verify the linter is working.

- **If it fails due to lint errors:** That's fine — the linter works. Tell the user there are lint issues they can fix with `bun run lint`.
- **If it fails due to missing eslint or config issues:** That's a setup problem. Help diagnose.

## 10. Check environment variables

Check for environment variables that packages in this repo may need at runtime. Do NOT create any files — just warn about what's missing.

**Required env vars to check:**

- None (for now)

**Optional env vars:**

- `RENDER_API_KEY` — Only needed if deploying to Render. Check and note if missing, but don't treat it as blocking.

- `OPENAI_API_KEY` — Used by the `openai-summarizer` package for OpenAI API calls. Check if it is set in the current shell environment. If not, warn the user that they'll need to set it before using the CLI or any feature that calls OpenAI.

Also check if `apps/api/.env.example` exists and remind the user to copy it to `apps/api/.env` if they plan to run the API server locally (check if `apps/api/.env` already exists first — if it does, skip this).

## 11. Summary

Print a summary table of all checks:

| Step                   | Status       |
| ---------------------- | ------------ |
| Node.js >= 22          | pass/fail    |
| Bun >= 1.3.9           | pass/fail    |
| Update template name   | pass/fail    |
| README rewritten       | pass/skipped |
| Dependencies installed | pass/fail    |
| Build                  | pass/fail    |
| Type check             | pass/fail    |
| Tests                  | pass/fail    |
| Linter                 | pass/fail    |
| Environment variables  | pass/warn/ok |

If everything passed, tell the user they're good to go and remind them of the key commands:

- `bun run docker:build:api` — build the API server app docker image
- `bun run docker:start:api` - run the API server app in docker
- `bun run dev:cli` — Run the CLI
- `bun run test` — Run tests
- `bun run lint` — Lint and fix

---

## Maintaining This Skill

This skill should be updated when the repo's setup requirements change. Common triggers:

- **New runtime dependency added** (e.g., a package starts requiring Redis or Postgres): Add a check in the appropriate section, or add a new section before the summary.
- **New environment variable required**: Add it to the "Check environment variables" section. Specify which package uses it and whether it's required or optional.
- **Node or Bun version requirement changes**: Update the version check in sections 1 or 2.
- **New workspace package or app added**: no build-script change needed — `bun run build` (`bun --filter '*' build`) discovers all workspaces and orders them by dependency automatically. If the new package has unique prerequisites (native dependencies, external services), add a check here.
- **New bun script added to root package.json**: Only update this skill if the script represents a setup-critical step (like a new build phase or migration). Convenience scripts (like a new `start:*` variant) don't need setup changes, but should be added to the summary's "key commands" reminder if users should know about them.
- **New .env.example file added**: Add a check in section 10 to remind users to copy it.

When in doubt, ask: "Would a fresh clone fail or behave unexpectedly without this change in /setup?" If yes, update the skill.
