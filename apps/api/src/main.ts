import { createApp } from './app.js';

const PORT = parseInt(process.env.PORT || '8080', 10);

const app = createApp();

const server = Bun.serve({ port: PORT, hostname: '0.0.0.0', fetch: app.fetch });
console.log(`Server listening on port ${server.port}`);
