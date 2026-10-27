import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/**
 * The network boundary for web tests. Defaults: nobody is logged in and there
 * is no unfinished draft. Tests add their own handlers with server.use(...).
 */
export const server = setupServer(
  http.get('*/api/auth/me', () =>
    HttpResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Inicia sesión para continuar.' } },
      { status: 401 },
    ),
  ),
  http.get('*/api/bookings/draft/current', () =>
    HttpResponse.json(
      { error: { code: 'NO_DRAFT', message: 'No tienes reservas sin terminar.' } },
      { status: 404 },
    ),
  ),
);
