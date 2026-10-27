import type { UserRole } from '@lumni/shared';
import type { CookieOptions, RequestHandler } from 'express';
import { SESSION_HOURS, verifySessionToken } from '../modules/auth/session-token';
import { AppError } from './errors';

export const SESSION_COOKIE = 'lumni_session';

/**
 * httpOnly: JavaScript in the page can't read the token (XSS can't steal it).
 * sameSite lax: the browser doesn't send it on cross-site POSTs (basic CSRF protection).
 * secure: HTTPS only in production; local dev runs on http.
 */
export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_HOURS * 60 * 60 * 1000,
};

/** Sets req.user when the cookie holds a valid token. Never rejects by itself. */
export function sessionMiddleware(jwtSecret: string): RequestHandler {
  return async (req, _res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string') {
      req.user = (await verifySessionToken(token, jwtSecret)) ?? undefined;
    }
    next();
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
  next();
};

export function requireRole(role: UserRole): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
    if (req.user.role !== role) {
      throw new AppError(403, 'FORBIDDEN', 'No tienes permiso para esta acción.');
    }
    next();
  };
}
