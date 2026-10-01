import { describe, expect, it } from 'vitest';

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

  it.each(['/api', '/api/nope', '/api/nested/deeper'])(
    'unknown /api path %s returns a JSON 404',
    async (p) => {
      const res = await app.request(p);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'not found' });
    },
  );

  it.each(['/', '/about'])(
    'non-API path %s 404s — the web app is a static site, not served here',
    async (p) => {
      const res = await app.request(p);
      expect(res.status).toBe(404);
    },
  );
});
