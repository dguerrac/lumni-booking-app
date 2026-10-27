import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/**
 * The network boundary for web tests. Default: nobody is logged in.
 * Tests add their own handlers with server.use(...).
 */
export const server = setupServer(
  http.get('*/api/auth/me', () =>
    HttpResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Inicia sesión para continuar.' } },
      { status: 401 },
    ),
  ),
);
