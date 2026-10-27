import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestApp } from './test/test-app';

const { app, db } = createTestApp();

afterAll(async () => {
  await db.destroy();
});

describe('app', () => {
  it('answers the health check', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns 404 in the error shape for an unknown API route', async () => {
    const res = await request(app).get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'ROUTE_NOT_FOUND', message: 'La ruta no existe.' },
    });
  });

  it('returns 400 when the body is not valid JSON', async () => {
    const res = await request(app)
      .post('/api/quotes')
      .set('Content-Type', 'application/json')
      .send('{"roomId": 1,');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MALFORMED_JSON');
  });
});
