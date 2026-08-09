import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { createApp } from './app.js';

describe('API routes', () => {
  const app = createApp();

  it('GET /health returns ok with a valid timestamp', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; timestamp: string };
    expect(body.status).toBe('ok');
    expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('GET /api/hello returns the greeting', async () => {
    const res = await app.request('/api/hello');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      message: 'Hello from the api endpoint!',
    });
  });

  it('GET /api/info returns service metadata', async () => {
    const res = await app.request('/api/info');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      service: 'api',
      version: '1.0.0',
      endpoints: ['/health', '/api/hello', '/api/info'],
    });
  });

  it('unknown /api paths return a JSON 404, not the SPA', async () => {
    for (const p of ['/api', '/api/nope', '/api/nested/deeper']) {
      const res = await app.request(p);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'not found' });
    }
  });

  it('non-API paths 404 when no webDist is configured', async () => {
    const res = await app.request('/about');
    expect(res.status).toBe(404);
  });
});

describe('static web app serving', () => {
  const webDist = fs.mkdtempSync(path.join(os.tmpdir(), 'api-webdist-'));
  fs.writeFileSync(
    path.join(webDist, 'index.html'),
    '<!doctype html><title>spa-fixture</title>',
  );
  fs.mkdirSync(path.join(webDist, 'assets'));
  fs.writeFileSync(
    path.join(webDist, 'assets', 'app.js'),
    'console.log("hi");',
  );
  const app = createApp({ webDist });

  afterAll(() => {
    fs.rmSync(webDist, { recursive: true, force: true });
  });

  it('serves static files from webDist', async () => {
    const res = await app.request('/assets/app.js');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('console.log("hi");');
  });

  it('serves index.html at the root', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('spa-fixture');
  });

  it('falls back to index.html for react-router paths on refresh', async () => {
    const res = await app.request('/about');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('spa-fixture');
  });

  it('still returns a JSON 404 for unknown /api/* paths', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not found' });
  });
});
