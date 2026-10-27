import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { requireEnv } from '../../config/env';
import { createDb } from '../../db/client';
import type { Database } from '../../db/types';
import { confirmedBooking, getSeedIds, insertBooking } from '../../test/factories';
import type { ConfirmationPayload } from './confirmation-email';
import type { EmailSender } from './email-sender';
import { processDueEmails } from './outbox-worker';
import type { OutgoingEmail } from './render-confirmation-email';

let db: Kysely<Database>;
let anaId: number;
let roomId: number;

const T0 = new Date('2026-11-02T13:00:00.000Z');
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
const noJitter = () => 0.5;

const payload: ConfirmationPayload = {
  contactName: 'Ana Gómez',
  roomName: 'Sala Andes',
  date: '2026-11-03',
  startTime: '09:00',
  endTime: '11:00',
  partySize: 3,
  extras: {},
  price: { base: 80_000, discount: 0, surcharge: 0, extrasTotal: 0, total: 80_000 },
};

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

/** A confirmed booking with its queued email. `hour` keeps bookings from overlapping. */
async function queuedEmail(overrides: Record<string, unknown> = {}, hour = 9) {
  const h = String(hour).padStart(2, '0');
  const booking = await insertBooking(
    db,
    confirmedBooking({
      customer_id: anaId,
      room_id: roomId,
      starts_at: `2026-11-03T${h}:00:00-05:00`,
      ends_at: `2026-11-03T${h}:30:00-05:00`,
    }),
  );
  return db
    .insertInto('email_outbox')
    .values({
      booking_id: booking.id,
      kind: 'booking_confirmed',
      to_email: 'ana@andes.studio',
      payload: JSON.stringify(payload),
      next_attempt_at: T0,
      ...overrides,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** A fake SMTP: plays the given outcomes in order (then always succeeds) and records every call. */
function scriptedSender(outcomes: ('ok' | 'fail')[] = []) {
  const calls: OutgoingEmail[] = [];
  const sender: EmailSender = {
    async send(email) {
      calls.push(email);
      if (outcomes[calls.length - 1] === 'fail')
        throw new Error('SMTP 421: servicio no disponible');
    },
  };
  return { sender, calls };
}

const emailRow = (id: string) =>
  db.selectFrom('email_outbox').selectAll().where('id', '=', id).executeTakeFirstOrThrow();

const run = (sender: EmailSender, now: Date) =>
  processDueEmails({ db, sender, now, random: noJitter });

describe('processDueEmails', () => {
  it('sends a due email once and records it', async () => {
    const email = await queuedEmail();
    const { sender, calls } = scriptedSender();

    await run(sender, T0);

    expect(calls).toEqual([
      expect.objectContaining({
        to: 'ana@andes.studio',
        messageId: `<booking-confirmed.${email.booking_id}@lumni.local>`,
      }),
    ]);
    expect(await emailRow(email.id)).toMatchObject({
      status: 'sent',
      attempts: 1,
      sent_at: T0,
      last_error: null,
      locked_until: null,
    });
  });

  it('leaves an email alone until it is due', async () => {
    const email = await queuedEmail({ next_attempt_at: at(30) });
    const { sender, calls } = scriptedSender();

    await run(sender, T0);

    expect(calls).toEqual([]);
    expect((await emailRow(email.id)).status).toBe('pending');
  });

  it('retries with a growing wait and ends up sent (fails twice, works the third time)', async () => {
    const email = await queuedEmail();
    const { sender, calls } = scriptedSender(['fail', 'fail', 'ok']);

    await run(sender, T0);
    expect(await emailRow(email.id)).toMatchObject({
      status: 'retrying',
      attempts: 1,
      next_attempt_at: at(5),
      last_error: 'SMTP 421: servicio no disponible',
    });

    await run(sender, at(4)); // not due yet
    expect(calls).toHaveLength(1);

    await run(sender, at(5));
    expect(await emailRow(email.id)).toMatchObject({
      status: 'retrying',
      attempts: 2,
      next_attempt_at: at(15),
    });

    await run(sender, at(15));
    expect(await emailRow(email.id)).toMatchObject({
      status: 'sent',
      attempts: 3,
      last_error: null,
    });
    expect(calls).toHaveLength(3);
  });

  it('gives up after 6 attempts (1 + 5 retries) and marks the email failed', async () => {
    const email = await queuedEmail();
    const { sender, calls } = scriptedSender(Array(10).fill('fail'));

    // Due times with no jitter: 0, +5, +10, +20, +40, +80 seconds after each failure.
    for (const second of [0, 5, 15, 35, 75, 155]) await run(sender, at(second));
    await run(sender, at(10_000)); // much later: nothing left to try

    expect(calls).toHaveLength(6);
    expect(await emailRow(email.id)).toMatchObject({
      status: 'failed',
      attempts: 6,
      last_error: 'SMTP 421: servicio no disponible',
    });
  });

  it('skips emails another worker has claimed (FOR UPDATE SKIP LOCKED)', async () => {
    const locked = await queuedEmail({}, 9);
    const free = await queuedEmail({}, 10);
    const { sender, calls } = scriptedSender();

    // Another worker is in the middle of claiming `locked`: its row lock is held.
    await db.transaction().execute(async (otherWorker) => {
      await sql`SELECT id FROM email_outbox WHERE id = ${locked.id} FOR UPDATE`.execute(
        otherWorker,
      );
      await run(sender, T0);
    });

    expect(calls.map((c) => c.messageId)).toEqual([
      `<booking-confirmed.${free.booking_id}@lumni.local>`,
    ]);
    expect((await emailRow(locked.id)).status).toBe('pending');
  });

  it("doesn't touch an email another worker is sending right now (its lease hasn't expired)", async () => {
    const email = await queuedEmail({ status: 'sending', attempts: 1, locked_until: at(60) });
    const { sender, calls } = scriptedSender();

    await run(sender, T0);

    expect(calls).toEqual([]);
    expect((await emailRow(email.id)).status).toBe('sending');
  });

  it('picks up an email whose worker crashed mid-send (expired lease)', async () => {
    const email = await queuedEmail({ status: 'sending', attempts: 1, locked_until: at(-1) });
    const { sender, calls } = scriptedSender();

    await run(sender, T0);

    expect(calls).toHaveLength(1);
    expect(await emailRow(email.id)).toMatchObject({ status: 'sent', attempts: 2 });
  });

  it('two workers running at once send every email exactly once', async () => {
    const emails = [];
    for (let hour = 7; hour < 19; hour++) emails.push(await queuedEmail({}, hour));
    const a = scriptedSender();
    const b = scriptedSender();

    await Promise.all([run(a.sender, T0), run(b.sender, T0), run(a.sender, T0), run(b.sender, T0)]);

    const sent = [...a.calls, ...b.calls].map((c) => c.messageId);
    expect(sent).toHaveLength(12);
    expect(new Set(sent).size).toBe(12);
  });

  it('claims at most 10 emails per run', async () => {
    for (let hour = 7; hour < 19; hour++) await queuedEmail({}, hour);
    const { sender, calls } = scriptedSender();

    await run(sender, T0);

    expect(calls).toHaveLength(10);
  });
});
