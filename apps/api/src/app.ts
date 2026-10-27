import express from 'express';
import type { AppDeps } from './deps';
import { errorHandler, notFoundHandler } from './http/errors';
import { quotesRouter } from './modules/quotes/quotes.routes';
import { roomsRouter } from './modules/rooms/rooms.routes';

// The app is built by a function (not at import time) so tests can create it
// with Supertest, a test database and a frozen clock, without opening a port.
export function createApp(deps: AppDeps) {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/rooms', roomsRouter(deps));
  app.use('/api/quotes', quotesRouter(deps));

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
