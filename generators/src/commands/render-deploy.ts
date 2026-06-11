import { readFile, writeFile } from 'fs/promises';
import { basename, join } from 'path';

import { Command } from 'commander';

const RENDER_YAML_PATH = 'render.yaml';

const renderDeploy = new Command('render-deploy')
  .description(
    'Add Render deployment files (Dockerfile, .dockerignore) and update render.yaml for an app in apps/',
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
      await generateDockerignore(targetPath);
      await appendToRenderYaml(appName, basename(process.cwd()));

      console.log('\n✓ Render deploy files generated successfully!');
      console.log('\nNext steps:');
      console.log(
        '1. Create a Blueprint in the Render dashboard pointing to render.yaml',
      );
      console.log(
        '   (one-time setup: https://dashboard.render.com/select-repo?type=blueprint)',
      );

      console.log('2. Then, commit your changes to the main branch:');
      console.log('   git add && git commit -a');

      console.log('3. Finally, just push to main to deploy:');
      console.log('   git push origin main');
    } catch (error) {
      console.error('Error generating deploy files:', error);
      process.exit(1);
    }
  });

async function generateDockerfile(basePath: string, appName: string) {
  const content = `# Stage 1: Build the single executable binary
FROM oven/bun:1.3.3-alpine AS builder

WORKDIR /app

# Copy the entire monorepo so bun has full workspace context
COPY . .

# Install all dependencies (full monorepo)
RUN bun install

# Compile the app into a single executable binary
RUN bun build --compile apps/${appName}/src/main.ts --outfile main

# Stage 2: Minimal runtime with the binary
FROM alpine:3.23

RUN apk add --no-cache ca-certificates libstdc++ libgcc

COPY --from=builder /app/main /app/main

EXPOSE 80

CMD ["/app/main"]
`;

  await writeFile(join(basePath, 'Dockerfile'), content);
  console.log('✓ Created Dockerfile');
}

async function generateDockerignore(basePath: string) {
  const content = `node_modules
dist
.env
.env.local
.git
.gitignore
`;

  await writeFile(join(basePath, '.dockerignore'), content);
  console.log('✓ Created .dockerignore');
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
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 80
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
