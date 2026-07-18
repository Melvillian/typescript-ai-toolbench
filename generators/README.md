# Project Generators

This directory contains project generators for quickly scaffolding common project patterns.

## Usage

This directory is a bun workspace, so its dependencies are installed by `bun install` at the repo root. Build the generators:

The expected way to use this generator is via Claude Code, which will build and run the `render-deploy` generator command

````claude
/generate-render-deploy
```

To build it manually, you can run:

```bash
bun --filter generators build
````

Run a generator:

```bash
bun bin/generator.js <generator-name> [options]
```

## Available Generators

### render-deploy

Adds Render deployment files (Dockerfile) and updates `render.yaml` for an app in `apps/`.

```bash
bun bin/generator.js render-deploy <app-name>
```

This creates:

- A Dockerfile for the app under `apps/<app-name>`
- A service entry in the root `render.yaml`, named `<repository-name>-<app-name>`

After generating, create a Blueprint in the Render dashboard pointing to `render.yaml` (one-time setup), then commit and push to main to deploy.

## Adding New Generators

1. Create a new command file in `src/commands/`
2. Export a Commander.js command
3. Import and add it to `src/index.ts`
4. Rebuild with `bun run build`
