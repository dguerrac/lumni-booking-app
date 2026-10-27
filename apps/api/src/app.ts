import express from 'express';

// The app is built by a function (not at import time) so tests can create it
// with Supertest without opening a port.
export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
