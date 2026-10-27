import { sql } from 'kysely';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { confirmedBooking, getSeedIds, insertBooking } from '../../test/factories';
import { createTestApp } from '../../test/test-app';

// "now" is frozen at Monday 2 Nov 2026, 08:00 Bogotá (see test-app.ts).
const TUESDAY = '2026-11-03';
const SUNDAY = '2026-11-08';

const { app, db } = createTestApp();
let customerId: number;
let smallRoomId: number;

beforeAll(async () => {
  const ids = await getSeedIds(db);
  customerId = ids.customerAId;
  smallRoomId = ids.roomIds[0]!; // Sala Andes, small
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(async () => {
  await sql`TRUNCATE bookings CASCADE`.execute(db);
});

const quote = (body: object) => request(app).post('/api/quotes').send(body);

describe('POST /api/quotes', () => {
  it('quotes a free, valid slot as bookable', async () => {
    const res = await quote({
      roomId: smallRoomId,
      date: TUESDAY,
      startTime: '09:00',
      durationHours: 2,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      roomId: smallRoomId,
      date: TUESDAY,
      startTime: '09:00',
      durationHours: 2,
      startsAt: '2026-11-03T09:00:00.000-05:00',
      endsAt: '2026-11-03T11:00:00.000-05:00',
      dayHours: { opensAt: '07:00', closesAt: '21:00' },
      breakdown: { base: 80_000, discount: 0, surcharge: 0, extrasTotal: 0, total: 80_000 },
      bookable: true,
      reasons: [],
      nextAvailable: null,
    });
  });

  it('marks a taken slot as not bookable and suggests the next free one', async () => {
    await insertBooking(
      db,
      confirmedBooking({
        customer_id: customerId,
        room_id: smallRoomId,
        starts_at: '2026-11-03T09:00:00-05:00',
        ends_at: '2026-11-03T11:00:00-05:00',
      }),
    );

    const res = await quote({
      roomId: smallRoomId,
      date: TUESDAY,
      startTime: '10:00',
      durationHours: 1,
    });

    expect(res.status).toBe(200);
    expect(res.body.bookable).toBe(false);
    expect(res.body.reasons).toEqual([
      { code: 'SLOT_TAKEN', message: 'La sala ya está reservada en ese horario.' },
    ]);
    expect(res.body.nextAvailable).toEqual({ startTime: '11:00', endTime: '12:00' });
  });

  it('explains a broken rule in Spanish and still shows the price', async () => {
    const res = await quote({
      roomId: smallRoomId,
      date: TUESDAY,
      startTime: '20:30',
      durationHours: 1,
    });

    expect(res.status).toBe(200);
    expect(res.body.bookable).toBe(false);
    expect(res.body.reasons).toEqual([
      { code: 'AFTER_CLOSING', message: 'La reserva debe terminar a más tardar a las 21:00.' },
    ]);
    expect(res.body.breakdown.total).toBe(40_000);
    expect(res.body.nextAvailable).toBeNull();
  });

  it('says Sunday is closed', async () => {
    const res = await quote({
      roomId: smallRoomId,
      date: SUNDAY,
      startTime: '10:00',
      durationHours: 1,
    });

    expect(res.body.reasons.map((r: { code: string }) => r.code)).toEqual(['CLOSED_DAY']);
    expect(res.body.dayHours).toBeNull();
  });

  it('includes the extras in the total', async () => {
    const res = await quote({
      roomId: smallRoomId,
      date: TUESDAY,
      startTime: '09:00',
      durationHours: 2,
      extras: { projector: true, coffee: 2 },
    });

    expect(res.body.breakdown).toEqual({
      base: 80_000,
      discount: 0,
      surcharge: 0,
      extrasTotal: 46_000,
      total: 126_000,
    });
  });

  it('rejects a malformed body with 400 and the field that failed', async () => {
    const res = await quote({
      roomId: smallRoomId,
      date: 'mañana',
      startTime: '09:00',
      durationHours: 2,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual([
      expect.objectContaining({ path: ['date'], message: 'Usa el formato AAAA-MM-DD.' }),
    ]);
  });

  it('rejects unknown fields, so nobody can send a price', async () => {
    const res = await quote({
      roomId: smallRoomId,
      date: TUESDAY,
      startTime: '09:00',
      durationHours: 2,
      total: 0,
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 for a room that does not exist', async () => {
    const res = await quote({ roomId: 9999, date: TUESDAY, startTime: '09:00', durationHours: 2 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
  });
});
