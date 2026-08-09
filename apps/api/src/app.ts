import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

export interface AppOptions {
  /** Absolute path to the built apps/web SPA; omit to run API-only. */
  webDist?: string;
}

export function createApp(options: AppOptions = {}): Hono {
  const app = new Hono();

  // 10mb body cap — parity with the old express.json({ limit: '10mb' })
  app.use(bodyLimit({ maxSize: 10 * 1024 * 1024 }));

  app.get('/health', (c) =>
    c.json({ status: 'ok', timestamp: new Date().toISOString() }),
  );

  app.get('/api/hello', (c) =>
    c.json({ message: 'Hello from the api endpoint!' }),
  );

  // Service info (moved from GET / — the root path now serves the web app)
  app.get('/api/info', (c) =>
    c.json({
      service: 'api',
      version: '1.0.0',
      endpoints: ['/health', '/api/hello', '/api/info'],
    }),
  );

  // Unknown /api paths are API 404s, not SPA fallthroughs. '/api/*' does not
  // match bare '/api', so register both.
  app.all('/api', (c) => c.json({ error: 'not found' }, 404));
  app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));

  // Task 2 adds static serving + SPA fallback here, gated on options.webDist
  void options;

  return app;
}
