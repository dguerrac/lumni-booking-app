import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/test-app';

const { app, db } = createTestApp();

afterAll(async () => {
  await db.destroy();
});

const login = (email: string, password: string) =>
  request(app).post('/api/auth/login').send({ email, password });

const anaGomez = {
  id: expect.any(Number),
  email: 'cliente.a@lumni.test',
  name: 'Ana Gómez',
  phone: '3001234567',
  company: 'Andes Studio',
  role: 'customer',
};

describe('POST /api/auth/login', () => {
  it('logs in with the right password and sets an httpOnly session cookie', async () => {
    const res = await login('cliente.a@lumni.test', 'ClienteA123!');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: anaGomez });
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/^lumni_session=/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('accepts the email in any letter case', async () => {
    const res = await login('  Cliente.A@Lumni.TEST ', 'ClienteA123!');

    expect(res.status).toBe(200);
  });

  it.each([
    ['a wrong password', 'cliente.a@lumni.test', 'wrong-password'],
    ['an unknown email', 'nadie@lumni.test', 'ClienteA123!'],
  ])('gives the same 401 for %s, so it does not reveal which emails exist', async (_c, e, p) => {
    const res = await login(e, p);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' },
    });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rejects a malformed body with 400', async () => {
    const res = await login('not-an-email', '');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the logged-in user', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'admin@lumni.test', password: 'Admin123!' });

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'admin@lumni.test', role: 'admin' });
  });

  it('returns 401 without a session', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 with a forged cookie', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'lumni_session=forged.token.here');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('ends the session', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ email: 'cliente.b@lumni.test', password: 'ClienteB123!' });

    const logout = await agent.post('/api/auth/logout');
    const me = await agent.get('/api/auth/me');

    expect(logout.status).toBe(204);
    expect(me.status).toBe(401);
  });
});
