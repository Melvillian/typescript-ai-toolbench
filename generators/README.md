# Project Generators

This directory contains project generators for quickly scaffolding common project patterns.

## Usage

This directory is a bun workspace, so its dependencies are installed by `bun install` at the repo root. Build the generators:

```bash
bun --filter generators build
```

Run a generator:

```bash
bun bin/generator.js <generator-name> [options]
```

## Available Generators

### tailscale-render-endpoint

Generates a Tailscale-enabled Render private service with SSL termination.

```bash
bun bin/generator.js tailscale-render-endpoint -p ./my-project
```

This creates:

- Dockerfile with Tailscale integration
- render.yaml for Render deployment
- Express server listening on port 80
- Complete documentation and setup instructions

See the generated README.md for detailed setup and deployment instructions.

## Adding New Generators

1. Create a new command file in `src/commands/`
2. Export a Commander.js command
3. Import and add it to `src/index.ts`
4. Rebuild with `bun run build`
