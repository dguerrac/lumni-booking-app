import type { SessionUser } from '../modules/auth/session-token';

// req.user is set by sessionMiddleware when the session cookie is valid.
declare module 'express-serve-static-core' {
  interface Request {
    user?: SessionUser;
  }
}
