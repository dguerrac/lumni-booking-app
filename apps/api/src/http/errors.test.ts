import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { InvalidTransitionError } from '../modules/bookings/domain/state-machine';
import { AppError, errorHandler, NotFoundError, notFoundHandler } from './errors';

// A tiny app whose routes throw each kind of error, so the middleware is
// tested on its own: every error must leave as { error: { code, message, details? } }.
const app = express();
app.use(express.json());
app.get('/zod', () => {
  z.object({ email: z.string().email('Escribe un correo válido.') }).parse({ email: 'x' });
});
app.get('/app-error', () => {
  throw new AppError(422, 'SLOT_NOT_VALID', 'Ese horario no se puede reservar.', [
    { code: 'IN_PAST' },
  ]);
});
app.get('/not-found', () => {
  throw new NotFoundError('BOOKING_NOT_FOUND', 'La reserva no existe.');
});
app.get('/transition', () => {
  throw new InvalidTransitionError('cancelled', 'confirmed');
});
app.get('/async-bug', async () => {
  await Promise.resolve();
  throw new Error('connection to db at 10.0.0.5 refused (password=hunter2)');
});
app.post('/json', (_req, res) => {
  res.json({ ok: true });
});
app.use('/', notFoundHandler);
app.use(errorHandler);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorHandler', () => {
  it('turns a Zod error into 400 VALIDATION_ERROR with the issues', async () => {
    const res = await request(app).get('/zod');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [expect.objectContaining({ path: ['email'], message: 'Escribe un correo válido.' })],
    });
  });

  it('keeps the status, code, message and details of an AppError', async () => {
    const res = await request(app).get('/app-error');

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: {
        code: 'SLOT_NOT_VALID',
        message: 'Ese horario no se puede reservar.',
        details: [{ code: 'IN_PAST' }],
      },
    });
  });

  it('sends no details key when there are none', async () => {
    const res = await request(app).get('/not-found');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'BOOKING_NOT_FOUND', message: 'La reserva no existe.' },
    });
  });

  it('turns a forbidden state transition into 409 INVALID_TRANSITION', async () => {
    const res = await request(app).get('/transition');

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_TRANSITION',
      message: 'Una reserva cancelada no puede pasar a confirmada.',
    });
  });

  it('answers an unexpected error with a generic 500 and never leaks its message', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).get('/async-bug');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' },
    });
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(logged).toHaveBeenCalled(); // the real cause goes to the server log
  });

  it('turns an unparseable JSON body into 400 MALFORMED_JSON', async () => {
    const res = await request(app).post('/json').set('Content-Type', 'application/json').send('{');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MALFORMED_JSON');
  });

  it('answers an unknown route with 404 ROUTE_NOT_FOUND', async () => {
    const res = await request(app).get('/nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
