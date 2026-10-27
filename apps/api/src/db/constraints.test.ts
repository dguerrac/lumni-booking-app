import { type Insertable, type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { requireEnv } from '../config/env';
import { confirmedBooking, getSeedIds, insertBooking } from '../test/factories';
import { createDb } from './client';
import type { BookingsTable, Database } from './types';

// These tests prove the guarantees live in PostgreSQL itself, independent of
// any service code.

let db: Kysely<Database>;
let customerId: number;
let roomA: number;
let roomB: number;

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

const confirmed = (roomId: number, startsAt: string, endsAt: string) =>
  confirmedBooking({
    customer_id: customerId,
    room_id: roomId,
    starts_at: startsAt,
    ends_at: endsAt,
  });

const insert = (booking: Insertable<BookingsTable>) => insertBooking(db, booking);

describe('no_overlap_confirmed exclusion constraint', () => {
  it('rejects a second confirmed booking that overlaps in the same room', async () => {
    await insert(confirmed(roomA, '2026-11-03T10:00:00-05:00', '2026-11-03T12:00:00-05:00'));

    await expect(
      insert(confirmed(roomA, '2026-11-03T11:30:00-05:00', '2026-11-03T13:00:00-05:00')),
    ).rejects.toMatchObject({ code: '23P01' });
  });

  it('allows back-to-back bookings (ranges are half-open)', async () => {
    await insert(confirmed(roomA, '2026-11-03T10:00:00-05:00', '2026-11-03T12:00:00-05:00'));

    await expect(
      insert(confirmed(roomA, '2026-11-03T12:00:00-05:00', '2026-11-03T14:30:00-05:00')),
    ).resolves.toBeDefined();
  });

  it('allows the same time in a different room', async () => {
    await insert(confirmed(roomA, '2026-11-03T10:00:00-05:00', '2026-11-03T12:00:00-05:00'));

    await expect(
      insert(confirmed(roomB, '2026-11-03T10:00:00-05:00', '2026-11-03T12:00:00-05:00')),
    ).resolves.toBeDefined();
  });

  it('ignores drafts: two drafts can hold the same slot', async () => {
    const draft = {
      customer_id: customerId,
      room_id: roomA,
      starts_at: '2026-11-03T10:00:00-05:00',
      ends_at: '2026-11-03T12:00:00-05:00',
    };
    await insert(draft);

    await expect(insert(draft)).resolves.toBeDefined();
  });
});

describe('CHECK constraints', () => {
  it('rejects a confirmed booking without a frozen total', async () => {
    await expect(
      insert({
        ...confirmed(roomA, '2026-11-03T10:00:00-05:00', '2026-11-03T12:00:00-05:00'),
        total: null,
      }),
    ).rejects.toMatchObject({ code: '23514', constraint: 'confirmed_has_slot_and_price' });
  });

  it('rejects a cancelled booking without a reason', async () => {
    await expect(
      insert({ customer_id: customerId, status: 'cancelled', cancelled_at: new Date() }),
    ).rejects.toMatchObject({ code: '23514', constraint: 'cancelled_has_reason' });
  });

  it('rejects a slot that ends before it starts', async () => {
    await expect(
      insert({
        customer_id: customerId,
        starts_at: '2026-11-03T12:00:00-05:00',
        ends_at: '2026-11-03T10:00:00-05:00',
      }),
    ).rejects.toMatchObject({ code: '23514', constraint: 'slot_positive' });
  });
});
