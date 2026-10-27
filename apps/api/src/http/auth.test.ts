import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { signSessionToken } from '../modules/auth/session-token';
import { requireAuth, requireRole, SESSION_COOKIE, sessionMiddleware } from './auth';
import { errorHandler } from './errors';

const SECRET = 'test-secret-with-enough-length-1234';

// A tiny app with only the auth middleware, so these tests don't depend on
// which real routes exist yet.
const app = express();
app.use(cookieParser());
app.use(sessionMiddleware(SECRET));
app.get('/private', requireAuth, (req, res) => {
  res.json({ userId: req.user!.id });
});
app.get('/admin-only', requireRole('admin'), (_req, res) => {
  res.json({ ok: true });
});
app.use(errorHandler);

const cookieFor = async (role: 'customer' | 'admin') =>
  `${SESSION_COOKIE}=${await signSessionToken({ id: 42, role }, SECRET)}`;

describe('requireAuth', () => {
  it('lets a valid session through and exposes req.user', async () => {
    const res = await request(app)
      .get('/private')
      .set('Cookie', await cookieFor('customer'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 42 });
  });

  it('returns 401 without a session', async () => {
    const res = await request(app).get('/private');

    expect(res.status).toBe(401);
  });
});

describe('requireRole("admin")', () => {
  it('lets an admin through', async () => {
    const res = await request(app)
      .get('/admin-only')
      .set('Cookie', await cookieFor('admin'));

    expect(res.status).toBe(200);
  });

  it('returns 403 for a customer', async () => {
    const res = await request(app)
      .get('/admin-only')
      .set('Cookie', await cookieFor('customer'));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 401 without a session', async () => {
    const res = await request(app).get('/admin-only');

    expect(res.status).toBe(401);
  });
});
