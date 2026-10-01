# generators

Commander CLI that scaffolds project files; `/generate-render-deploy` builds
and runs it. Add commands in `src/commands/` and register them in
`src/index.ts`.

- Build first (`bun --filter generators build`); `bin/generator.js` runs the
  compiled `dist/`.
- `render-deploy` names services `<repo>-<app>` via `serviceNameFor` in
  `src/commands/render-deploy.ts`. The repo name is the basename of the
  directory it runs from, so run it from the repo root.
- The version comes from `package.json` at runtime. A standalone binary
  compiled with `bun build --compile` cannot read it, so the version falls
  back to the compile-time `BUILD_VERSION` define (see `src/index.ts`).
