# Stage 1: Build with the full node image (ships gcc/make/python3 for native
# addons; no apt needed). bun is required to resolve the workspace:* protocol.
FROM node:24-bookworm AS builder

RUN npm i -g bun@1.3.14

WORKDIR /app

# Build context is the repo root (see root .dockerignore).
COPY . .

RUN bun install --frozen-lockfile
RUN bun run build

# Stage 2: Slim Bun runtime. Same bun version as the builder so any native
# addon compiled during bun install loads against the same embedded Node ABI
# (bun@1.3.14 embeds Node 24).
FROM oven/bun:1.3.14-slim

WORKDIR /app

# Whole tree: node_modules (addons + workspace symlinks), dist, runtime files.
COPY --from=builder /app /app

ENV NODE_ENV=production PORT=80

EXPOSE 80

# Run under Bun as an interpreter. Do not compile to a single binary: that
# pattern shipped without node_modules or on-disk assets and broke native
# addons and runtime file reads (see
# docs/superpowers/specs/2026-06-22-render-template-improvements-design.md).
CMD ["bun", "apps/api/dist/main.js"]
