import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

export function createApp(): Hono {
  const app = new Hono();

  // 10mb body cap — parity with the pre-migration middleware's limit
  app.use(bodyLimit({ maxSize: 10 * 1024 * 1024 }));

  app.get('/health', (c) =>
    c.json({ status: 'ok', timestamp: new Date().toISOString() }),
  );

  app.get('/api/hello', (c) =>
    c.json({ message: 'Hello from the api endpoint!' }),
  );

  app.get('/api/info', (c) =>
    c.json({
      service: 'api',
      version: '1.0.0',
      endpoints: ['/health', '/api/hello', '/api/info'],
    }),
  );

  // Unknown /api paths are JSON 404s. '/api/*' does not match bare '/api',
  // so register both. The web app (apps/web) is NOT served here — it deploys
  // as a Render static site whose /api/* rewrite proxies to this service
  // (see the render-deploys skill).
  app.all('/api', (c) => c.json({ error: 'not found' }, 404));
  app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));

  return app;
}
