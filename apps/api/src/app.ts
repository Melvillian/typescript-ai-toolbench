import fs from 'node:fs';
import path from 'node:path';

import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { serveStatic } from 'hono/serve-static';

export interface AppOptions {
  /** Absolute path to the built apps/web SPA; omit to run API-only. */
  webDist?: string;
}

export function createApp(options: AppOptions = {}): Hono {
  const app = new Hono();

  // 10mb body cap — parity with the pre-migration middleware's limit
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

  // Static web app. Handlers run in registration order, so the API routes
  // above always win; the static middleware calls next() on a miss, landing
  // on the SPA fallback so react-router deep links (e.g. /about) survive a
  // refresh. Uses the runtime-agnostic hono/serve-static base with node:fs
  // readers (Bun implements node:fs natively) — NOT hono/bun's serveStatic,
  // whose handler needs the Bun global and would crash vitest, which runs
  // under Node. With path.join injected, an absolute webDist root is fine.
  if (options.webDist) {
    const webDist = options.webDist;
    app.use(
      '*',
      serveStatic({
        root: webDist,
        join: path.join,
        isDir: async (p) => {
          try {
            return (await fs.promises.stat(p)).isDirectory();
          } catch {
            return false;
          }
        },
        getContent: async (p) => {
          try {
            return await fs.promises.readFile(p);
          } catch {
            return null;
          }
        },
      }),
    );
    app.get('*', async (c) =>
      c.html(
        await fs.promises.readFile(path.join(webDist, 'index.html'), 'utf8'),
      ),
    );
  }

  return app;
}
