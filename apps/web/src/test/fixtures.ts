import type { QuoteResponse, RoomDto, UserDto } from '@lumni/shared';
import { http, HttpResponse } from 'msw';
import { server } from './server';

export const anaGomez: UserDto = {
  id: 1,
  email: 'cliente.a@lumni.test',
  name: 'Ana Gómez',
  phone: '3001234567',
  company: 'Andes Studio',
  role: 'customer',
};

/** A fake session: /me answers 401 until /login succeeds, and again after /logout. */
export function mockSession({ loggedInAs }: { loggedInAs: UserDto | null }) {
  let current = loggedInAs;
  server.use(
    http.get('*/api/auth/me', () =>
      current
        ? HttpResponse.json({ user: current })
        : HttpResponse.json(
            { error: { code: 'UNAUTHENTICATED', message: 'Inicia sesión para continuar.' } },
            { status: 401 },
          ),
    ),
    http.post('*/api/auth/login', async ({ request }) => {
      const body = (await request.json()) as { email: string; password: string };
      if (body.email === anaGomez.email && body.password === 'ClienteA123!') {
        current = anaGomez;
        return HttpResponse.json({ user: anaGomez });
      }
      return HttpResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' } },
        { status: 401 },
      );
    }),
    http.post('*/api/auth/logout', () => {
      current = null;
      return new HttpResponse(null, { status: 204 });
    }),
  );
}

export const rooms: RoomDto[] = [
  { id: 1, name: 'Sala Andes', size: 'small', capacity: 4, hourlyRate: 40_000 },
  { id: 5, name: 'Sala Orinoco', size: 'large', capacity: 16, hourlyRate: 120_000 },
];

export function mockRooms() {
  server.use(http.get('*/api/rooms', () => HttpResponse.json(rooms)));
}

/** A quote response for Tuesday 3 Nov 2026; override what the test cares about. */
export function quoteResponse(overrides: Partial<QuoteResponse> = {}): QuoteResponse {
  return {
    roomId: 1,
    date: '2026-11-03',
    startTime: '09:00',
    durationHours: 2,
    startsAt: '2026-11-03T09:00:00.000-05:00',
    endsAt: '2026-11-03T11:00:00.000-05:00',
    dayHours: { opensAt: '07:00', closesAt: '21:00' },
    breakdown: { base: 80_000, discount: 0, surcharge: 0, extrasTotal: 0, total: 80_000 },
    bookable: true,
    reasons: [],
    nextAvailable: null,
    ...overrides,
  };
}
