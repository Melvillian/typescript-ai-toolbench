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

  it('unknown /api paths return a JSON 404', async () => {
    const responses = await Promise.all(
      ['/api', '/api/nope', '/api/nested/deeper'].map(async (p) =>
        app.request(p),
      ),
    );
    for (const res of responses) {
      expect(res.status).toBe(404);
    }
    const bodies = await Promise.all(responses.map((res) => res.json()));
    for (const body of bodies) {
      expect(body).toEqual({ error: 'not found' });
    }
  });

  it('non-API paths 404 — the web app is a static site, not served here', async () => {
    const responses = await Promise.all(
      ['/', '/about'].map(async (p) => app.request(p)),
    );
    for (const res of responses) {
      expect(res.status).toBe(404);
    }
  });
});
