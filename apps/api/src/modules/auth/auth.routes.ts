import { loginRequestSchema } from '@lumni/shared';
import { Router } from 'express';
import type { AppDeps } from '../../deps';
import { requireAuth, SESSION_COOKIE, sessionCookieOptions } from '../../http/auth';
import { getCurrentUser, login } from './auth.service';
import { signSessionToken } from './session-token';

export function authRouter({ db, jwtSecret }: AppDeps) {
  const router = Router();

  router.post('/login', async (req, res) => {
    const input = loginRequestSchema.parse(req.body);
    const user = await login(db, input);
    const token = await signSessionToken({ id: user.id, role: user.role }, jwtSecret);

    res.cookie(SESSION_COOKIE, token, sessionCookieOptions).json({ user });
  });

  router.post('/logout', (_req, res) => {
    const { maxAge: _maxAge, ...clearOptions } = sessionCookieOptions;
    res.clearCookie(SESSION_COOKIE, clearOptions).status(204).end();
  });

  router.get('/me', requireAuth, async (req, res) => {
    res.json({ user: await getCurrentUser(db, req.user!.id) });
  });

  return router;
}
