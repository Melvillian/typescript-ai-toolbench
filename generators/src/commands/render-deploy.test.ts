import { mkdtemp, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, expect, it, beforeEach } from 'vitest';

import { appendToRenderYaml, serviceNameFor } from './render-deploy.js';

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
