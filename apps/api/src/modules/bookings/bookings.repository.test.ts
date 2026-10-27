import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { requireEnv } from '../../config/env';
import { createDb } from '../../db/client';
import type { Database } from '../../db/types';
import { confirmedBooking, getSeedIds, insertBooking } from '../../test/factories';
import { findBlockingBookings } from './bookings.repository';

let db: Kysely<Database>;
let customerId: number;
let roomA: number;
let roomB: number;

// Tuesday 3 Nov 2026, the whole opening day in Bogotá.
const from = new Date('2026-11-03T07:00:00-05:00');
const to = new Date('2026-11-03T21:00:00-05:00');

beforeAll(async () => {
  db = createDb(requireEnv('TEST_DATABASE_URL'));
  const ids = await getSeedIds(db);
  customerId = ids.customerAId;
  [roomA, roomB] = ids.roomIds as [number, number];
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(async () => {
  await sql`TRUNCATE bookings`.execute(db);
});

const at = (time: string) => `2026-11-03T${time}:00-05:00`;
const book = (roomId: number, start: string, end: string, extra = {}) =>
  insertBooking(
    db,
    confirmedBooking({
      customer_id: customerId,
      room_id: roomId,
      starts_at: at(start),
      ends_at: at(end),
      ...extra,
    }),
  );

describe('findBlockingBookings', () => {
  it('returns confirmed and completed bookings of the room, ordered by start', async () => {
    const later = await book(roomA, '15:00', '16:00');
    const earlier = await book(roomA, '09:00', '10:30', { status: 'completed' });

    const blocking = await findBlockingBookings(db, { roomId: roomA, from, to });

    expect(blocking).toEqual([
      { id: earlier.id, startsAt: new Date(at('09:00')), endsAt: new Date(at('10:30')) },
      { id: later.id, startsAt: new Date(at('15:00')), endsAt: new Date(at('16:00')) },
    ]);
  });

  it('ignores drafts and cancelled bookings', async () => {
    await insertBooking(db, {
      customer_id: customerId,
      room_id: roomA,
      starts_at: at('09:00'),
      ends_at: at('10:00'),
    });
    await book(roomA, '11:00', '12:00', {
      status: 'cancelled',
      cancel_reason: 'Cliente canceló',
      cancelled_at: new Date(),
    });

    expect(await findBlockingBookings(db, { roomId: roomA, from, to })).toEqual([]);
  });

  it('ignores bookings of other rooms', async () => {
    await book(roomB, '09:00', '10:00');

    expect(await findBlockingBookings(db, { roomId: roomA, from, to })).toEqual([]);
  });

  it('ignores bookings that only touch the range edges', async () => {
    await book(roomA, '10:00', '12:00');

    const blocking = await findBlockingBookings(db, {
      roomId: roomA,
      from: new Date(at('12:00')),
      to: new Date(at('14:00')),
    });

    expect(blocking).toEqual([]);
  });
});
