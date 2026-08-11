# A Toolbench of Typescript Apps & Packages To Start Off Your Web Services

This is a template for a monorepo that uses best practices for building Typescript web services.

It is what @Melvillian considers best practice in July 2026.

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
- React 19 + Vite SPA (`apps/web`) with react-router and Tailwind CSS v4, deployed as a Render static site
- Single-command dev (`bun run dev`) and prod-build (`bun run start`) full-stack flows
- NodeNext node resolution
- CLI via @commander
- Hono (on the Bun runtime) for the API server
- Prettier for code formatting
- ESLint for linting
- VSCode will auto-format on save and paste
- Vitest for testing with coverage support
- Github action CI

## Commands

| Command                    | Description                                                                |
| -------------------------- | -------------------------------------------------------------------------- |
| `bun run build`            | Build all packages and apps                                                |
| `bun run dev`              | Build packages, then start api (:8080) and web dev server (:5173) together |
| `bun run dev:api`          | Build packages, then run the API server in watch mode                      |
| `bun run dev:cli`          | Build packages, then run the CLI app                                       |
| `bun run dev:web`          | Build packages, then run the Vite dev server                               |
| `bun run docker:build:api` | Build the API Docker image                                                 |
| `bun run docker:start:api` | Run the API Docker image on port 8080                                      |
| `bun run start`            | Build everything, then run the full stack: api (:8080) + web (:4173)       |
| `bun run test`             | Run tests (vitest)                                                         |
| `bun run test:watch`       | Run tests in watch mode                                                    |
| `bun run test:coverage`    | Generate test coverage report                                              |
| `bun run lint`             | Lint and fix (eslint)                                                      |
| `bun run lint:check`       | Lint check only                                                            |
| `bun run typecheck`        | Type check all packages                                                    |
| `bun run format`           | Format code (prettier)                                                     |
| `bun run clean`            | Remove dist directories                                                    |
| `bun run clean:all`        | Remove dist + node_modules                                                 |
| `bun run cloc`             | Count lines of code                                                        |
| `bun run depcheck`         | Report unused dependencies                                                 |

`bun run start` is the go-to full-stack command: it builds everything, then
runs the api (:8080) and the web app via `vite preview` (:4173). The preview
server serves the production `dist/` bundle and proxies `/api` to the api —
the same shape as production, where the Render static site's `/api/*` rewrite
proxies to the api service.

To run the full stack with the api in Docker instead (deploy parity), use two
terminals: `bun run docker:build:api && bun run docker:start:api` in one, then
`bun --filter web preview` in the other — the preview proxy targets :8080,
which the Docker container publishes.

## Environment variables

- `PORT` — API listen port; defaults to 8080 locally (no `.env` needed), and the Docker image sets 80 for production. Optionally override via `apps/api/.env` (see `apps/api/.env.example`)
- `OPENAI_API_KEY` — Required for OpenAI-powered features (used by `openai-summarizer`)
- `RENDER_API_KEY` — Optional, only needed for Render deployments
