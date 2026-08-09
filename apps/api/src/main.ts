import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from './app.js';

const PORT = parseInt(process.env.PORT || '8080', 10);

// Static web app (apps/web). Resolved relative to this file so it works both
// compiled (dist/main.js) and in dev (bun --watch src/main.ts) — ../../web/dist
// lands on apps/web/dist either way. Override with WEB_DIST_PATH.
const webDist =
  process.env.WEB_DIST_PATH ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');

const hasWeb = fs.existsSync(webDist);
if (!hasWeb) {
  console.warn(`web dist not found at ${webDist}; running API-only`);
}

const app = createApp(hasWeb ? { webDist } : {});

const server = Bun.serve({ port: PORT, hostname: '0.0.0.0', fetch: app.fetch });
console.log(`Server listening on port ${server.port}`);
