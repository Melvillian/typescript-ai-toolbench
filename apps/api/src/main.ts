import express, { json } from 'express';

const app = express();
const PORT = parseInt(process.env.PORT || '80', 10);

// Middleware
app.use(json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Example API endpoint
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Tailscale-enabled Render endpoint!' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'api',
    version: '1.0.0',
    endpoints: ['/health', '/api/hello'],
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
