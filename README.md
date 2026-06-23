# TypeScript + Cli + Rest API + (TODO) React App Mono Repository

This is a template for a monorepo that uses best practices for building Typescript web services.

It is what @Melvillian considers best practice in April 2026.

## Setup

> **Using Claude Code?** Just run `/setup` — it checks all prerequisites, installs dependencies, builds everything, and verifies your environment. No manual steps needed.

### Manual setup

Requires **Node >= 22** and **Bun >= 1.3.9**.

```bash
bun install
bun run build
```

See the [Environment variables](#environment-variables) section below for required configuration.

## Features

- Mono-repository using bun workspaces
- TypeScript for type safety
- ES Modules for fast builds
- NodeNext node resolution
- (TODO) React for UI
- Tailwindcss for styling
- Both (TODO) react and vanilla JS libraries
- Command line, (TODO) React app, and web server
- Vite for Bundling, CSS Handling, Live Reloading
- CLI via @commander
- Express for the API server
- Hot reload of (TODO) React
- Auto service restart for the web server
- Prettier for code formatting
- ESLint for linting
- VSCode will auto-format on save and paste
- Vitest for testing with coverage support
- Github action CI

## Commands

| Command                    | Description                                           |
| -------------------------- | ----------------------------------------------------- |
| `bun run build`            | Build all packages and apps                           |
| `bun run dev:cli`          | Build packages, then run the CLI app                  |
| `bun run dev:api`          | Build packages, then run the API server in watch mode |
| `bun run docker:build:api` | Build the API Docker image                            |
| `bun run docker:start:api` | Run the API Docker image on port 8080                 |
| `bun run test`             | Run tests (vitest)                                    |
| `bun run test:watch`       | Run tests in watch mode                               |
| `bun run test:coverage`    | Generate test coverage report                         |
| `bun run lint`             | Lint and fix (eslint)                                 |
| `bun run lint:check`       | Lint check only                                       |
| `bun run typecheck`        | Type check all packages                               |
| `bun run format`           | Format code (prettier)                                |
| `bun run clean`            | Remove dist directories                               |
| `bun run clean:all`        | Remove dist + node_modules                            |
| `bun run cloc`             | Count lines of code                                   |
| `bun run depcheck`         | Report unused dependencies                            |

## Environment variables

- `OPENAI_API_KEY` — Required for OpenAI-powered features (used by `openai-summarizer`)
- `RENDER_API_KEY` — Optional, only needed for Render deployments
