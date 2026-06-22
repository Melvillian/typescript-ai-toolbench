import { mkdtemp, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, expect, it, beforeEach } from 'vitest';

import {
  appendToRenderYaml,
  dockerfileContent,
  serviceNameFor,
} from './render-deploy.js';

describe('dockerfileContent', () => {
  it('builds with node + bun and runs under node (no --compile binary)', () => {
    const df = dockerfileContent('api');
    expect(df).toContain('FROM node:24-bookworm AS builder');
    expect(df).toContain('RUN bun run build');
    expect(df).toContain('CMD ["node", "apps/api/dist/main.js"]');
    expect(df).not.toContain('--compile');
  });

  it('interpolates the app name into the CMD path', () => {
    expect(dockerfileContent('worker')).toContain(
      'CMD ["node", "apps/worker/dist/main.js"]',
    );
  });
});

describe('serviceNameFor', () => {
  it('prefixes the app name with the repository name', () => {
    expect(serviceNameFor('caroline-nanny-website', 'api')).toBe(
      'caroline-nanny-website-api',
    );
  });
});

describe('appendToRenderYaml', () => {
  let dir: string;
  let yamlPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'render-deploy-test-'));
    yamlPath = join(dir, 'render.yaml');
  });

  it('writes a service entry named <repo-name>-<app-name>', async () => {
    await appendToRenderYaml('api', 'caroline-nanny-website', yamlPath);

    const yaml = await readFile(yamlPath, 'utf-8');
    expect(yaml).toContain('name: caroline-nanny-website-api');
    expect(yaml).toContain('dockerfilePath: apps/api/Dockerfile');
    expect(yaml).toContain('healthCheckPath: /health');
    expect(yaml).not.toMatch(/name: api\b/);
  });

  it('skips appending when a service with the derived name already exists', async () => {
    await writeFile(
      yamlPath,
      'services:\n\n  - type: web\n    name: caroline-nanny-website-api\n',
    );

    await appendToRenderYaml('api', 'caroline-nanny-website', yamlPath);

    const yaml = await readFile(yamlPath, 'utf-8');
    const occurrences = yaml.match(/name: caroline-nanny-website-api/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });
});
