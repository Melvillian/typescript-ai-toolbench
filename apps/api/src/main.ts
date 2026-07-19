import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import 'dotenv/config';
import express, { json, static as serveStatic } from 'express';

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

// Middleware
app.use(json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Example API endpoint
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the api endpoint!' });
});

// Service info (moved from GET / — the root path now serves the web app)
app.get('/api/info', (req, res) => {
  res.json({
    service: 'api',
    version: '1.0.0',
    endpoints: ['/health', '/api/hello', '/api/info'],
  });
});

// Unknown /api/* paths are API 404s, not SPA fallthroughs
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not found' });
});

// Static web app (apps/web). Resolved relative to this file so it works both
// compiled (dist/main.js) and in dev (tsx src/main.ts) — ../../web/dist lands
// on apps/web/dist either way. Override with WEB_DIST_PATH.
const webDist =
  process.env.WEB_DIST_PATH ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');

if (fs.existsSync(webDist)) {
  app.use(serveStatic(webDist));
  // SPA fallback: let react-router handle any non-API GET (e.g. /about on
  // refresh). API routes above win because they're registered first. This is
  // Express 4 catch-all syntax; Express 5's router would reject '*'.
  app.get('*', (req, res) => {
    res.sendFile('index.html', { root: webDist });
  });
} else {
  console.warn(`web dist not found at ${webDist}; running API-only`);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
