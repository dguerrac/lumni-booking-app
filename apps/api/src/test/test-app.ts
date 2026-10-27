import request from 'supertest';
import { DateTime } from 'luxon';
import { createApp } from '../app';
import { requireEnv } from '../config/env';
import { createDb } from '../db/client';

/** Fixed "now" for API tests: Monday 2 Nov 2026, 08:00 in Bogotá. */
export const TEST_NOW = DateTime.fromISO('2026-11-02T08:00', { zone: 'America/Bogota' });

export const TEST_JWT_SECRET = 'test-secret-with-enough-length-1234';

/** An app wired to the real test database and a frozen clock. Call db.destroy() in afterAll. */
export function createTestApp() {
  const db = createDb(requireEnv('TEST_DATABASE_URL'));
  const app = createApp({ db, now: () => TEST_NOW, jwtSecret: TEST_JWT_SECRET });
  return { app, db };
}

const LOGINS = {
  anaGomez: { email: 'cliente.a@lumni.test', password: 'ClienteA123!' },
  brunoDiaz: { email: 'cliente.b@lumni.test', password: 'ClienteB123!' },
  admin: { email: 'admin@lumni.test', password: 'Admin123!' },
} as const;

/** A Supertest agent that keeps the session cookie of a seeded user. */
export async function loggedInAgent(
  app: Parameters<typeof request.agent>[0],
  who: keyof typeof LOGINS,
) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send(LOGINS[who]);
  if (res.status !== 200) throw new Error(`Login as ${who} failed: ${res.status}`);
  return agent;
}
