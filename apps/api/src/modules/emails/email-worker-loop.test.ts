import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireEnv } from '../../config/env';
import { createDb } from '../../db/client';
import type { Database } from '../../db/types';
import { confirmedBooking, getSeedIds, insertBooking } from '../../test/factories';
import type { EmailSender } from './email-sender';
import { startEmailWorker } from './email-worker-loop';

let db: Kysely<Database>;
let anaId: number;
let roomId: number;

beforeAll(async () => {
  db = createDb(requireEnv('TEST_DATABASE_URL'));
  const ids = await getSeedIds(db);
  anaId = ids.customerAId;
  roomId = ids.roomIds[0]!;
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(async () => {
  await sql`TRUNCATE bookings CASCADE`.execute(db);
});

async function queueEmail() {
  const booking = await insertBooking(
    db,
    confirmedBooking({
      customer_id: anaId,
      room_id: roomId,
      starts_at: '2026-11-03T09:00:00-05:00',
      ends_at: '2026-11-03T11:00:00-05:00',
    }),
  );
  await db
    .insertInto('email_outbox')
    .values({
      booking_id: booking.id,
      kind: 'booking_confirmed',
      to_email: 'ana@andes.studio',
      payload: JSON.stringify({
        contactName: 'Ana',
        roomName: 'Sala Andes',
        date: '2026-11-03',
        startTime: '09:00',
        endTime: '11:00',
        partySize: 2,
        extras: {},
        price: { base: 80_000, discount: 0, surcharge: 0, extrasTotal: 0, total: 80_000 },
      }),
    })
    .execute();
}

describe('startEmailWorker', () => {
  it('keeps polling: an email queued after the worker started still gets sent', async () => {
    const sent: string[] = [];
    const sender: EmailSender = { send: async (email) => void sent.push(email.to) };
    const worker = startEmailWorker({ db, sender, intervalMs: 20, log: () => {} });

    await queueEmail();

    await vi.waitFor(() => expect(sent).toEqual(['ana@andes.studio']), { timeout: 2000 });
    await worker.stop();
  });

  it('stops cleanly: no pass starts after stop() resolves', async () => {
    let passes = 0;
    const sender: EmailSender = { send: async () => {} };
    const worker = startEmailWorker({
      db,
      sender,
      intervalMs: 10,
      log: () => {},
      onPass: () => {
        passes += 1;
      },
    });
    await vi.waitFor(() => expect(passes).toBeGreaterThan(1));

    await worker.stop();
    const passesAtStop = passes;
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(passes).toBe(passesAtStop);
  });

  it('survives a failing pass (for example, the database restarting) and tries again', async () => {
    const errors: unknown[] = [];
    let calls = 0;
    const flakyDb = new Proxy(db, {
      get(target, prop, receiver) {
        // The first pass fails as if the database were unreachable.
        if (prop === 'transaction' && calls++ === 0) {
          return () => {
            throw new Error('connection terminated');
          };
        }
        // Kysely uses private class fields, so methods must run on the real object.
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const sent: string[] = [];
    const worker = startEmailWorker({
      db: flakyDb,
      sender: { send: async (email) => void sent.push(email.to) },
      intervalMs: 10,
      log: (...args) => errors.push(args),
    });
    await queueEmail();

    await vi.waitFor(() => expect(sent).toHaveLength(1), { timeout: 2000 });
    await worker.stop();
    expect(errors.length).toBeGreaterThan(0);
  });
});
