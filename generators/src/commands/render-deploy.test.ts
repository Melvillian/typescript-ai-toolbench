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
  it('builds with node + bun and runs under bun (no --compile binary)', () => {
    const df = dockerfileContent('api');
    expect(df).toContain('FROM node:24-bookworm AS builder');
    expect(df).toContain('RUN bun run build');
    expect(df).toContain('FROM oven/bun:1.3.14-slim');
    expect(df).toContain('CMD ["bun", "apps/api/dist/main.js"]');
    expect(df).not.toContain('--compile');
  });

  it('interpolates the app name into the CMD path', () => {
    expect(dockerfileContent('worker')).toContain(
      'CMD ["bun", "apps/worker/dist/main.js"]',
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

  describe('static mode', () => {
    it('writes a static site entry with build command, publish path, and SPA fallback', async () => {
      await appendToRenderYaml('web', 'caroline-nanny-website', yamlPath, {
        static: true,
      });

      const yaml = await readFile(yamlPath, 'utf-8');
      expect(yaml).toContain('name: caroline-nanny-website-web');
      expect(yaml).toContain('runtime: static');
      expect(yaml).toContain(
        'buildCommand: bun install --frozen-lockfile && bun run build',
      );
      expect(yaml).toContain('staticPublishPath: apps/web/dist');
      expect(yaml).toContain('destination: /index.html');
    });

    it('does not include web-service-only fields', async () => {
      await appendToRenderYaml('web', 'caroline-nanny-website', yamlPath, {
        static: true,
      });

      const yaml = await readFile(yamlPath, 'utf-8');
      expect(yaml).not.toContain('dockerfilePath');
      expect(yaml).not.toContain('env: docker');
      expect(yaml).not.toContain('healthCheckPath');
    });

    it('skips appending when the derived service name already exists', async () => {
      await appendToRenderYaml('web', 'caroline-nanny-website', yamlPath, {
        static: true,
      });
      await appendToRenderYaml('web', 'caroline-nanny-website', yamlPath, {
        static: true,
      });

      const yaml = await readFile(yamlPath, 'utf-8');
      const occurrences = yaml.match(/name: caroline-nanny-website-web/g) ?? [];
      expect(occurrences).toHaveLength(1);
    });

    it('includes a commented hybrid rewrite template for same-repo /api calls', async () => {
      await appendToRenderYaml('web', 'caroline-nanny-website', yamlPath, {
        static: true,
      });

      const yaml = await readFile(yamlPath, 'utf-8');
      expect(yaml).toContain('# - type: rewrite');
      expect(yaml).toContain('#   source: /api/*');
    });
  });
});
