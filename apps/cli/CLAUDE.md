# apps/cli

Commander CLI. Add commands in `src/commands/` and register them in
`src/index.ts`.

- `bun run build:single` compiles a standalone binary that cannot read
  `package.json` at runtime, so the version falls back to the `BUILD_VERSION`
  define (see `src/index.ts`).
- Prefer `wellcrafted` for user-defined error types (Rust-style tagged
  errors) over ad-hoc `Error` subclasses.
