import type { AdminBookingDto, BookingDto, QuoteResponse, RoomDto, UserDto } from '@lumni/shared';
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

export const DRAFT_ID = '7f3c2a10-5b1e-4c8a-9d2f-0a1b2c3d4e5f';

/** A fresh draft of Ana for Sala Andes, Tuesday 3 Nov 2026 09:00–11:00. */
export function bookingDto(overrides: Partial<BookingDto> = {}): BookingDto {
  return {
    id: DRAFT_ID,
    status: 'draft',
    currentStep: 1,
    roomId: 1,
    date: '2026-11-03',
    startTime: '09:00',
    durationHours: 2,
    partySize: null,
    contact: {
      name: anaGomez.name,
      email: anaGomez.email,
      phone: anaGomez.phone,
      company: anaGomez.company,
    },
    extras: {},
    price: null,
    confirmedAt: null,
    createdAt: '2026-11-02T13:00:00.000Z',
    updatedAt: '2026-11-02T13:00:00.000Z',
    ...overrides,
  };
}

/** GET /api/bookings/draft/current answers with this draft. */
export function mockCurrentDraft(draft: BookingDto) {
  server.use(http.get('*/api/bookings/draft/current', () => HttpResponse.json(draft)));
}

export const adminUser: UserDto = {
  id: 3,
  email: 'admin@lumni.test',
  name: 'Admin Lumni',
  phone: null,
  company: 'Lumni Coworking',
  role: 'admin',
};

/** A confirmed booking of Ana as the admin sees it; override what the test needs. */
export function adminBookingDto(overrides: Partial<AdminBookingDto> = {}): AdminBookingDto {
  return {
    ...bookingDto({
      status: 'confirmed',
      currentStep: 3,
      partySize: 3,
      confirmedAt: '2026-11-02T13:30:00.000Z',
      price: { base: 80_000, discount: 0, surcharge: 0, extrasTotal: 0, total: 80_000 },
    }),
    customer: { id: anaGomez.id, name: anaGomez.name, email: anaGomez.email },
    roomName: 'Sala Andes',
    cancelReason: null,
    cancelledAt: null,
    ...overrides,
  };
}
