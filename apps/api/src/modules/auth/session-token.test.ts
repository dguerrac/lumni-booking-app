import { describe, expect, it } from 'vitest';
import { signSessionToken, verifySessionToken } from './session-token';

const SECRET = 'test-secret-with-enough-length-1234';
const customer = { id: 7, role: 'customer' } as const;

describe('session token', () => {
  it('round-trips the user id and role', async () => {
    const token = await signSessionToken(customer, SECRET);

    expect(await verifySessionToken(token, SECRET)).toEqual({ id: 7, role: 'customer' });
  });

  it('rejects a token signed with another secret', async () => {
    const token = await signSessionToken(customer, 'another-secret-with-enough-length');

    expect(await verifySessionToken(token, SECRET)).toBeNull();
  });

  it('rejects a tampered token', async () => {
    const token = await signSessionToken(customer, SECRET);
    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: '7', role: 'admin' })).toString(
      'base64url',
    );

    expect(await verifySessionToken(`${header}.${forgedPayload}.${signature}`, SECRET)).toBeNull();
  });

  it('rejects an expired token (sessions last 8 hours)', async () => {
    const nineHoursAgo = new Date(Date.now() - 9 * 60 * 60 * 1000);
    const token = await signSessionToken(customer, SECRET, nineHoursAgo);

    expect(await verifySessionToken(token, SECRET)).toBeNull();
  });

  it('rejects garbage', async () => {
    expect(await verifySessionToken('not-a-jwt', SECRET)).toBeNull();
  });
});
