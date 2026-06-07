# packages/

Importable TypeScript modules containing the actual logic. Each package exposes an interface that a corresponding app (or another package) depends on and implements it. There is no standard interface shape; it depends on what the module does.

## 🔴 MANDATORY: required scripts for every package

**Any `package.json` created under `packages/` MUST define all four correctness scripts below.** This is not optional and is enforced at the coding-agent level: if you are an agent generating a new package, you may not finish the task until its `package.json` contains every one of these scripts, verbatim.

```jsonc
"scripts": {
  "build": "tsc",
  "typecheck": "tsc --noEmit",
  "test": "vitest run --root . --passWithNoTests",
  "lint": "eslint src --fix"
  // package-specific scripts (dev, etc.) go here as well
}
```

### Why this is mandatory — the silent-failure trap

The root `package.json` fans these out with `bun --filter`:

- `bun run build` → runs each sub-module's `build`
- `bun run typecheck` → runs each sub-module's `typecheck`

**`bun --filter` silently SKIPS any workspace that lacks the named script — no error, exit code 0.** A new package missing `typecheck` is therefore never type-checked by `bun run typecheck`, and the command still reports success. CI (`.github/workflows/ci.yml`) runs `build`, `typecheck`, `test`, and `lint` as blocking jobs; a package missing a script is silently excluded from that gate, so broken code can merge while CI stays green. The whole point of these scripts is to make that impossible.

`test` and `lint` use `--root .` / `eslint src` so they scope to **this package only**, and `--passWithNoTests` keeps `test` green before any tests exist. Do not omit a script just because the package has no tests yet — the script must still be present so coverage is uniform.

## ✅ Required verification before considering a new package done

After creating a package, run from the repo root and confirm all pass:

```bash
bun run build && bun run typecheck && bun --filter <package-name> test && bun --filter <package-name> lint
```

If any of the four scripts is missing from the new package's `package.json`, the task is incomplete — add it before finishing.

## Auto-Update Instructions

After changes to files in this directory, run `/update-claude-md`.
