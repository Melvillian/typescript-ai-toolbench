import { readFile, writeFile } from 'fs/promises';
import { basename, join } from 'path';

import { Command } from 'commander';

const RENDER_YAML_PATH = 'render.yaml';

const renderDeploy = new Command('render-deploy')
  .description(
    'Add Render deployment config for an app in apps/: a static site entry in render.yaml (--static), or a Dockerfile plus a Docker web service entry (default)',
  )
  .argument(
    '<app-name>',
    'Name of the app directory under apps/ (e.g. my-service)',
  )
  .option(
    '--static',
    'Deploy as a Render static site (no server, no Dockerfile; the app must build to apps/<app-name>/dist)',
  )
  .action(async (appName: string, options: { static?: boolean }) => {
    const targetPath = join('apps', appName);
    const isStatic = options.static ?? false;
    console.log(`Adding Render deploy files to: ${targetPath}`);

    try {
      if (!isStatic) {
        await generateDockerfile(targetPath, appName);
      }
      await appendToRenderYaml(appName, basename(process.cwd()), undefined, {
        static: isStatic,
      });

      console.log('\n✓ Render deploy files generated successfully!');
      console.log('\nNext steps:');
      console.log(
        '1. Create a Blueprint in the Render dashboard pointing to render.yaml',
      );
      console.log(
        '   (one-time setup: https://dashboard.render.com/select-repo?type=blueprint)',
      );
      if (isStatic) {
        console.log(
          '2. If this app fetches same-origin /api/* from a sibling web service,',
        );
        console.log(
          '   fill in the commented rewrite in render.yaml with that service’s',
        );
        console.log('   real .onrender.com URL (known after its first deploy)');
      } else {
        console.log('2. Commit your changes:');
        console.log('   git add -A && git commit');
      }
      console.log('3. Push to main to deploy:');
      console.log('   git push origin main');
    } catch (error) {
      console.error('Error generating deploy files:', error);
      process.exit(1);
    }
  });

export function dockerfileContent(appName: string): string {
  return `# Stage 1: Build with the full node image (ships gcc/make/python3 for native
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
CMD ["bun", "apps/${appName}/dist/main.js"]
`;
}

async function generateDockerfile(basePath: string, appName: string) {
  await writeFile(join(basePath, 'Dockerfile'), dockerfileContent(appName));
  console.log('✓ Created Dockerfile');
}

// Render appends its own random suffix to the .onrender.com subdomain, so a
// bare app name like "api" produces an unrecognizable domain (api-mvqh).
// Prefixing the repo name keeps domains identifiable across template clones.
export function serviceNameFor(repoName: string, appName: string): string {
  return `${repoName}-${appName}`;
}

// Static sites have no fixed compute cost (a Docker web service is $7+/mo),
// build in Render's native environment (bun is included via the root
// bun.lock, pinned by .bun-version), and serve from Render's CDN.
function staticSiteEntry(appName: string, serviceName: string): string {
  return `
  - type: web
    name: ${serviceName}
    runtime: static
    autoDeploy: true
    buildCommand: bun install --frozen-lockfile && bun run build
    staticPublishPath: apps/${appName}/dist
    routes:
      # Hybrid pattern: if this app fetches same-origin /api/* implemented by a
      # sibling web service, uncomment and set the destination to that
      # service's real .onrender.com URL (known only after its first deploy).
      # Must come before the /* fallback — routes match in order.
      # - type: rewrite
      #   source: /api/*
      #   destination: https://<repo>-api-<suffix>.onrender.com/api/*
      # SPA fallback: existing files are served directly; everything else
      # rewrites to index.html. Remove for non-SPA (multi-page) sites.
      - type: rewrite
        source: /*
        destination: /index.html
`;
}

function dockerServiceEntry(appName: string, serviceName: string): string {
  return `
  - type: web
    name: ${serviceName}
    env: docker
    autoDeploy: true
    dockerfilePath: apps/${appName}/Dockerfile
    healthCheckPath: /health
    envVars:
      # Image-constant env vars (also baked into the Dockerfile; safe to repeat):
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 80
      # Secrets: declare with \`sync: false\` and enter the value in the Render
      # dashboard (encrypted, never committed). Example:
      # - key: SOME_API_KEY
      #   sync: false
`;
}

export async function appendToRenderYaml(
  appName: string,
  repoName: string,
  renderYamlPath: string = RENDER_YAML_PATH,
  options: { static?: boolean } = {},
) {
  const serviceName = serviceNameFor(repoName, appName);
  const serviceEntry = options.static
    ? staticSiteEntry(appName, serviceName)
    : dockerServiceEntry(appName, serviceName);

  let existing = '';
  try {
    existing = await readFile(renderYamlPath, 'utf-8');
  } catch {
    // File doesn't exist, create it with the services header
    existing = 'services:\n';
  }

  if (existing.includes(`name: ${serviceName}`)) {
    console.log(
      `⚠ render.yaml already contains a service named '${serviceName}', skipping`,
    );
    return;
  }

  await writeFile(renderYamlPath, existing.trimEnd() + '\n' + serviceEntry);
  console.log('✓ Updated render.yaml');
}

export default renderDeploy;
