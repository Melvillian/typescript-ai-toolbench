import { readFile, writeFile } from 'fs/promises';
import { basename, join } from 'path';

import { Command } from 'commander';

const RENDER_YAML_PATH = 'render.yaml';

const renderDeploy = new Command('render-deploy')
  .description(
    'Add Render deployment files (Dockerfile) and update render.yaml for an app in apps/',
  )
  .argument(
    '<app-name>',
    'Name of the app directory under apps/ (e.g. my-service)',
  )
  .action(async (appName: string) => {
    const targetPath = join('apps', appName);
    console.log(`Adding Render deploy files to: ${targetPath}`);

    try {
      await generateDockerfile(targetPath, appName);
      await appendToRenderYaml(appName, basename(process.cwd()));

      console.log('\n✓ Render deploy files generated successfully!');
      console.log('\nNext steps:');
      console.log(
        '1. Regenerate the root build order (a new app changes the graph):',
      );
      console.log('   bun run gen:build-order');
      console.log(
        '2. Create a Blueprint in the Render dashboard pointing to render.yaml',
      );
      console.log(
        '   (one-time setup: https://dashboard.render.com/select-repo?type=blueprint)',
      );
      console.log('3. Commit your changes:');
      console.log('   git add -A && git commit');
      console.log('4. Push to main to deploy:');
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

# Stage 2: Slim runtime. Node major MUST match the builder (ABI) so any native
# addon loads; bun@1.3.14 embeds Node 24.
FROM node:24-bookworm-slim

WORKDIR /app

# Whole tree: node_modules (addons + workspace symlinks), dist, runtime files.
COPY --from=builder /app /app

ENV NODE_ENV=production PORT=80

EXPOSE 80

# Run under Node, not a bun-compiled binary.
CMD ["node", "apps/${appName}/dist/main.js"]
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

export async function appendToRenderYaml(
  appName: string,
  repoName: string,
  renderYamlPath: string = RENDER_YAML_PATH,
) {
  const serviceName = serviceNameFor(repoName, appName);
  const serviceEntry = `
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
