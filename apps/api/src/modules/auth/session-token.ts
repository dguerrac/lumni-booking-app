import { USER_ROLES, type UserRole } from '@lumni/shared';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

/** What the session carries: just enough to authorize, nothing personal. */
export type SessionUser = { id: number; role: UserRole };

export const SESSION_HOURS = 8;

const payloadSchema = z.object({
  sub: z.string().regex(/^\d+$/),
  role: z.enum(USER_ROLES),
});

const key = (secret: string) => new TextEncoder().encode(secret);

/** HS256 JWT. issuedAt is a parameter so tests can create an expired token. */
export async function signSessionToken(
  user: SessionUser,
  secret: string,
  issuedAt: Date = new Date(),
): Promise<string> {
  const iat = Math.floor(issuedAt.getTime() / 1000);
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_HOURS * 60 * 60)
    .sign(key(secret));
}

/** null for anything not valid: bad signature, expired, malformed, unexpected payload. */
export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ['HS256'] });
    const parsed = payloadSchema.safeParse(payload);
    return parsed.success ? { id: Number(parsed.data.sub), role: parsed.data.role } : null;
  } catch {
    return null;
  }
}
