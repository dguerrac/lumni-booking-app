import { sql } from 'kysely';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { confirmedBooking, getSeedIds, insertBooking } from '../../test/factories';
import { createTestApp, loggedInAgent } from '../../test/test-app';

const { app, db } = createTestApp();
let anaId: number;
let brunoId: number;
let andes: number; // Sala Andes
let caribe: number; // Sala Caribe
let ids: Record<'b1' | 'b2' | 'b3' | 'b4' | 'b5', string>;

beforeAll(async () => {
  const seed = await getSeedIds(db);
  anaId = seed.customerAId;
  brunoId = seed.customerBId;
  [andes, caribe] = seed.roomIds as [number, number];
});

afterAll(async () => {
  await db.destroy();
});

/** Five bookings, created one minute apart (b1 oldest, b5 newest). */
beforeEach(async () => {
  await sql`TRUNCATE bookings CASCADE`.execute(db);
  const at = (minute: number) => new Date(Date.UTC(2026, 10, 1, 12, minute));
  const slot = (date: string, from: string, to: string) => ({
    starts_at: `${date}T${from}:00-05:00`,
    ends_at: `${date}T${to}:00-05:00`,
  });

  const b1 = await insertBooking(db, {
    ...confirmedBooking({
      customer_id: anaId,
      room_id: andes,
      ...slot('2026-11-03', '09:00', '11:00'),
    }),
    created_at: at(1),
  });
  const b2 = await insertBooking(db, {
    ...confirmedBooking({
      customer_id: brunoId,
      room_id: caribe,
      ...slot('2026-11-03', '09:00', '11:00'),
    }),
    created_at: at(2),
  });
  const b3 = await insertBooking(db, {
    customer_id: anaId,
    room_id: andes,
    ...slot('2026-11-03', '13:00', '14:00'),
    status: 'cancelled',
    cancel_reason: 'Cliente canceló',
    cancelled_at: at(3),
    created_at: at(3),
  });
  const b4 = await insertBooking(db, {
    customer_id: brunoId,
    room_id: andes,
    ...slot('2026-11-04', '10:00', '11:00'),
    created_at: at(4),
  });
  const b5 = await insertBooking(db, {
    ...confirmedBooking({
      customer_id: anaId,
      room_id: caribe,
      ...slot('2026-10-30', '15:00', '16:00'),
    }),
    status: 'completed',
    created_at: at(5),
  });
  ids = { b1: b1.id, b2: b2.id, b3: b3.id, b4: b4.id, b5: b5.id };
});

async function asAdmin() {
  return loggedInAgent(app, 'admin');
}

const idsOf = (body: { items: { id: string }[] }) => body.items.map((item) => item.id);

describe('GET /api/admin/bookings', () => {
  it("lists every customer's bookings, newest first, with customer and room", async () => {
    const admin = await asAdmin();

    const res = await admin.get('/api/admin/bookings');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 5, page: 1, pageSize: 20 });
    expect(idsOf(res.body)).toEqual([ids.b5, ids.b4, ids.b3, ids.b2, ids.b1]);
    expect(res.body.items[4]).toMatchObject({
      id: ids.b1,
      status: 'confirmed',
      customer: { id: anaId, name: 'Ana Gómez', email: 'cliente.a@lumni.test' },
      roomName: 'Sala Andes',
      date: '2026-11-03',
      startTime: '09:00',
      durationHours: 2,
      price: { total: 80_000 },
    });
  });

  it('filters by status', async () => {
    const admin = await asAdmin();

    const res = await admin.get('/api/admin/bookings?status=confirmed');

    expect(idsOf(res.body)).toEqual([ids.b2, ids.b1]);
    expect(res.body.total).toBe(2);
  });

  it('filters by room', async () => {
    const admin = await asAdmin();

    const res = await admin.get(`/api/admin/bookings?roomId=${andes}`);

    expect(idsOf(res.body)).toEqual([ids.b4, ids.b3, ids.b1]);
  });

  it('combines both filters', async () => {
    const admin = await asAdmin();

    const res = await admin.get(`/api/admin/bookings?status=confirmed&roomId=${andes}`);

    expect(idsOf(res.body)).toEqual([ids.b1]);
    expect(res.body.total).toBe(1);
  });

  it('pages without overlaps or gaps, and the total counts every match', async () => {
    const admin = await asAdmin();

    const pages = await Promise.all(
      [1, 2, 3].map((page) => admin.get(`/api/admin/bookings?pageSize=2&page=${page}`)),
    );

    expect(pages.map((p) => idsOf(p.body))).toEqual([[ids.b5, ids.b4], [ids.b3, ids.b2], [ids.b1]]);
    expect(pages.map((p) => p.body.total)).toEqual([5, 5, 5]);
  });

  it('treats empty filters (from an empty select) as "all"', async () => {
    const admin = await asAdmin();

    const res = await admin.get('/api/admin/bookings?status=&roomId=');

    expect(res.body.total).toBe(5);
  });

  it.each([
    ['an unknown status', 'status=pending'],
    ['a page size over 100', 'pageSize=500'],
    ['page 0', 'page=0'],
  ])('rejects %s with 400', async (_case, query) => {
    const admin = await asAdmin();

    const res = await admin.get(`/api/admin/bookings?${query}`);

    expect(res.status).toBe(400);
  });

  it('is for admins only: a customer gets 403, no session gets 401', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');

    expect((await ana.get('/api/admin/bookings')).status).toBe(403);
    expect((await request(app).get('/api/admin/bookings')).status).toBe(401);
  });
});

describe('GET /api/admin/bookings/:id', () => {
  it("shows any customer's booking", async () => {
    const admin = await asAdmin();

    const res = await admin.get(`/api/admin/bookings/${ids.b2}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: ids.b2,
      customer: { id: brunoId, name: 'Bruno Díaz' },
      roomName: 'Sala Caribe',
    });
  });

  it('shows the cancel reason of a cancelled booking', async () => {
    const admin = await asAdmin();

    const res = await admin.get(`/api/admin/bookings/${ids.b3}`);

    expect(res.body).toMatchObject({ status: 'cancelled', cancelReason: 'Cliente canceló' });
  });

  it('answers 404 for a booking that does not exist', async () => {
    const admin = await asAdmin();

    const res = await admin.get('/api/admin/bookings/00000000-0000-4000-8000-000000000000');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/bookings/:id/cancel', () => {
  const cancel = async (id: string, body: object) =>
    (await asAdmin()).post(`/api/admin/bookings/${id}/cancel`).send(body);

  it('cancels a confirmed booking with the reason, and frees its slot', async () => {
    const res = await cancel(ids.b1, { reason: 'Mantenimiento de la sala' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'cancelled',
      cancelReason: 'Mantenimiento de la sala',
      cancelledAt: expect.any(String),
    });
    await expect(
      insertBooking(
        db,
        confirmedBooking({
          customer_id: brunoId,
          room_id: andes,
          starts_at: '2026-11-03T09:00:00-05:00',
          ends_at: '2026-11-03T11:00:00-05:00',
        }),
      ),
    ).resolves.toBeDefined();
  });

  it('can discard a customer draft', async () => {
    const res = await cancel(ids.b4, { reason: 'Borrador abandonado' });

    expect(res.body.status).toBe('cancelled');
  });

  it.each([
    ['without a reason', {}],
    ['with a reason shorter than 5 characters', { reason: ' no ' }],
  ])('refuses %s', async (_case, body) => {
    const res = await cancel(ids.b1, body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    ['cancelled', 'b3', 'Una reserva cancelada no puede pasar a cancelada.'],
    ['completed', 'b5', 'Una reserva completada no puede pasar a cancelada.'],
  ] as const)('refuses to cancel a %s booking', async (_case, key, message) => {
    const res = await cancel(ids[key], { reason: 'Motivo válido' });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({ code: 'INVALID_TRANSITION', message });
  });

  it('is for admins only', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');

    const res = await ana
      .post(`/api/admin/bookings/${ids.b1}/cancel`)
      .send({ reason: 'Me arrepentí' });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/admin/bookings/:id/complete', () => {
  // "now" is Monday 2 Nov 2026, 08:00 (test-app.ts).
  const complete = async (id: string) =>
    (await asAdmin()).post(`/api/admin/bookings/${id}/complete`);

  it('marks a confirmed booking that already ended as completed', async () => {
    const past = await insertBooking(
      db,
      confirmedBooking({
        customer_id: anaId,
        room_id: andes,
        starts_at: '2026-10-30T09:00:00-05:00',
        ends_at: '2026-10-30T10:00:00-05:00',
      }),
    );

    const res = await complete(past.id);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  it('refuses a booking that has not ended yet', async () => {
    const res = await complete(ids.b1);

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'BOOKING_NOT_FINISHED',
      message: 'Solo se puede completar una reserva que ya terminó.',
    });
  });

  it('refuses a draft', async () => {
    const res = await complete(ids.b4);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });
});

describe('confirmation email status (Part 2.1)', () => {
  const T = new Date('2026-11-02T13:00:00.000Z');

  function emailFor(bookingId: string, overrides: Record<string, unknown> = {}) {
    return db
      .insertInto('email_outbox')
      .values({
        booking_id: bookingId,
        kind: 'booking_confirmed',
        to_email: 'ana@andes.studio',
        payload: JSON.stringify({}),
        ...overrides,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  it('shows each booking’s email status in the list (null when it has none)', async () => {
    await emailFor(ids.b1, { status: 'sent', attempts: 1, sent_at: T });
    await emailFor(ids.b2, {
      status: 'retrying',
      attempts: 3,
      next_attempt_at: T,
      last_error: 'SMTP 421',
    });
    const admin = await asAdmin();

    const res = await admin.get('/api/admin/bookings');
    const byId = Object.fromEntries(
      res.body.items.map((item: { id: string; email: unknown }) => [item.id, item.email]),
    );

    expect(byId[ids.b1]).toEqual({
      status: 'sent',
      attempts: 1,
      maxAttempts: 6,
      lastError: null,
      sentAt: T.toISOString(),
      nextAttemptAt: expect.any(String),
    });
    expect(byId[ids.b2]).toMatchObject({ status: 'retrying', attempts: 3, lastError: 'SMTP 421' });
    expect(byId[ids.b4]).toBeNull(); // a draft has no email
  });

  it('shows the email status on the detail too', async () => {
    await emailFor(ids.b1, {
      status: 'failed',
      attempts: 6,
      last_error: 'SMTP 550: buzón no existe',
    });
    const admin = await asAdmin();

    const res = await admin.get(`/api/admin/bookings/${ids.b1}`);

    expect(res.body.email).toMatchObject({
      status: 'failed',
      attempts: 6,
      lastError: 'SMTP 550: buzón no existe',
    });
  });

  describe('POST /api/admin/bookings/:id/email/retry', () => {
    const retry = async (id: string) =>
      (await asAdmin()).post(`/api/admin/bookings/${id}/email/retry`);

    it('puts a failed email back in the queue with a fresh set of attempts', async () => {
      const email = await emailFor(ids.b1, {
        status: 'failed',
        attempts: 6,
        last_error: 'SMTP 550',
      });

      const res = await retry(ids.b1);

      expect(res.status).toBe(200);
      expect(res.body.email).toMatchObject({ status: 'pending', attempts: 0 });
      const row = await db
        .selectFrom('email_outbox')
        .selectAll()
        .where('id', '=', email.id)
        .executeTakeFirstOrThrow();
      expect(row.next_attempt_at.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('refuses to retry an email that has not failed', async () => {
      await emailFor(ids.b1, { status: 'sent', attempts: 1, sent_at: T });

      const res = await retry(ids.b1);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_NOT_FAILED');
    });

    it('answers 404 when the booking has no email', async () => {
      const res = await retry(ids.b4);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('EMAIL_NOT_FOUND');
    });
  });
});
