# apps/

Thin executable wrappers. Each app's entrypoint parses CLI args or sets up a server, then delegates to a package in `packages/`. Apps must not contain business logic.

## 🔴 MANDATORY: required scripts for every app

**Any `package.json` created under `apps/` MUST define all four correctness scripts below.** This is not optional and is enforced at the coding-agent level: if you are an agent generating a new app, you may not finish the task until its `package.json` contains every one of these scripts, verbatim.

```jsonc
"scripts": {
  "build": "tsc",
  "typecheck": "tsc --noEmit",
  "test": "vitest run --root . --passWithNoTests",
  "lint": "eslint src --fix"
  // app-specific scripts (start, dev, etc.) go here as well
}
```

### Why this is mandatory — the silent-failure trap

The root `package.json` fans these out with `bun --filter`:

- `bun run build` → runs each sub-module's `build`
- `bun run typecheck` → runs each sub-module's `typecheck`

**`bun --filter` silently SKIPS any workspace that lacks the named script — no error, exit code 0.** A new app missing `typecheck` is therefore never type-checked by `bun run typecheck`, and the command still reports success. CI (`.github/workflows/ci.yml`) runs `build`, `typecheck`, `test`, and `lint` as blocking jobs; an app missing a script is silently excluded from that gate, so broken code can merge while CI stays green. The whole point of these scripts is to make that impossible.

`test` and `lint` use `--root .` / `eslint src` so they scope to **this app only**, and `--passWithNoTests` keeps `test` green before any tests exist. Do not omit a script just because the app has no tests yet — the script must still be present so coverage is uniform.

## ✅ Required verification before considering a new app done

After creating an app, run from the repo root and confirm all pass:

```bash
bun run build && bun run typecheck && bun --filter <app-name> test && bun --filter <app-name> lint
```

If any of the four scripts is missing from the new app's `package.json`, the task is incomplete — add it before finishing.

## Auto-Update Instructions

After changes to files in this directory, run `/update-claude-md`.
