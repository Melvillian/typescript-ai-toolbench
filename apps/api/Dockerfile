# Stage 1: Build with the full node image (ships gcc/make/python3 for native
# addons; no apt needed). bun is required to resolve the workspace:* protocol.
FROM node:24-bookworm AS builder

RUN npm i -g bun@1.3.14

WORKDIR /app

# Build context is the repo root (see root .dockerignore).
COPY . .

RUN bun install --frozen-lockfile
RUN bun run build

# Stage 2: Slim runtime. Node major MUST match the builder (ABI) so any native
# addon loads; bun@1.3.14 embeds Node 24.
FROM node:24-bookworm-slim

WORKDIR /app

# Whole tree: node_modules (addons + workspace symlinks), dist, runtime files.
COPY --from=builder /app /app

ENV NODE_ENV=production PORT=80

EXPOSE 80

# Run under Node, not a bun-compiled binary.
CMD ["node", "apps/api/dist/main.js"]
