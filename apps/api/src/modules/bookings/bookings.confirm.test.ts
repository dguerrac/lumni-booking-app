import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { releaseTogether } from '../../test/concurrency';
import { getSeedIds, insertBooking } from '../../test/factories';
import { createTestApp, loggedInAgent } from '../../test/test-app';

// The two guarantees the test asks for, proven against real PostgreSQL:
//  1. Two customers confirming the same room and slot: only one wins.
//  2. The same booking confirmed twice: no duplicate, price not recalculated.

const TUESDAY = '2026-11-03';
const { app, db } = createTestApp();
let smallRoomId: number;
let anaId: number;

type Agent = Awaited<ReturnType<typeof loggedInAgent>>;

beforeAll(async () => {
  const ids = await getSeedIds(db);
  smallRoomId = ids.roomIds[0]!;
  anaId = ids.customerAId;
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(async () => {
  await sql`TRUNCATE bookings CASCADE`.execute(db);
});

/** A draft that went through wizard steps 1 and 3: Sala Andes, Tuesday 09:00–11:00. */
async function readyDraft(agent: Agent, extras: object = {}) {
  const created = await agent
    .post('/api/bookings')
    .send({ roomId: smallRoomId, date: TUESDAY, startTime: '09:00', durationHours: 2 });
  const id = created.body.id as string;
  await agent.patch(`/api/bookings/${id}`).send({
    step: 1,
    data: {
      contactName: 'Cliente',
      contactEmail: 'cliente@lumni.test',
      contactPhone: '3000000000',
      partySize: 3,
    },
  });
  await agent.patch(`/api/bookings/${id}`).send({ step: 3, data: extras });
  return id;
}

const confirm = (agent: Agent, id: string) => agent.post(`/api/bookings/${id}/confirm`);

describe('POST /api/bookings/:id/confirm', () => {
  it('confirms the draft and freezes the price computed by the server', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await readyDraft(ana, { projector: true });

    const res = await confirm(ana, id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'confirmed',
      price: { base: 80_000, discount: 0, surcharge: 0, extrasTotal: 30_000, total: 110_000 },
      confirmedAt: expect.any(String),
    });
    const row = await db.selectFrom('bookings').selectAll().where('id', '=', id).executeTakeFirst();
    expect(row).toMatchObject({ status: 'confirmed', base: 80_000, total: 110_000 });
  });

  it('is idempotent: confirming twice returns the same booking and creates nothing new', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await readyDraft(ana);

    const first = await confirm(ana, id);
    const second = await confirm(ana, id);

    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
  });

  it('never recalculates the agreed price', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await readyDraft(ana);
    await confirm(ana, id);
    // Pretend the price was agreed under older rates: the stored snapshot must win.
    await db
      .updateTable('bookings')
      .set({ base: 75_000, total: 75_000 })
      .where('id', '=', id)
      .execute();

    const again = await confirm(ana, id);

    expect(again.body.price.total).toBe(75_000);
  });

  it('handles the same draft confirmed twice at the same time: both succeed, one confirmation', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await readyDraft(ana);

    const [a, b] = await releaseTogether(
      db,
      [id],
      [() => confirm(ana, id), () => confirm(ana, id)],
    );

    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body.confirmedAt).toBe(b.body.confirmedAt);
    expect(a.body.price).toEqual(b.body.price);
  });

  it('lets only one of two customers confirm the same room and slot at the same time', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const bruno = await loggedInAgent(app, 'brunoDiaz');
    const anaDraft = await readyDraft(ana);
    const brunoDraft = await readyDraft(bruno);

    const results = await releaseTogether(
      db,
      [anaDraft, brunoDraft],
      [() => confirm(ana, anaDraft), () => confirm(bruno, brunoDraft)],
    );

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const loser = results.find((r) => r.status === 409)!;
    expect(loser.body.error).toMatchObject({
      code: 'SLOT_TAKEN',
      message: 'Otra persona acaba de confirmar ese horario.',
      details: { nextAvailable: { startTime: '11:00', endTime: '13:00' } },
    });
    const confirmed = await db
      .selectFrom('bookings')
      .select('id')
      .where('status', '=', 'confirmed')
      .execute();
    expect(confirmed).toHaveLength(1);
  });

  it('refuses a draft that skipped step 1, with the reason', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const created = await ana
      .post('/api/bookings')
      .send({ roomId: smallRoomId, date: TUESDAY, startTime: '09:00', durationHours: 2 });

    const res = await confirm(ana, created.body.id);

    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([
      expect.objectContaining({ code: 'PARTY_SIZE_REQUIRED' }),
    ]);
  });

  it('refuses to confirm a cancelled booking', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const cancelled = await insertBooking(db, {
      customer_id: anaId,
      room_id: smallRoomId,
      status: 'cancelled',
      cancel_reason: 'Cliente canceló',
      cancelled_at: new Date(),
    });

    const res = await confirm(ana, cancelled.id);

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_TRANSITION',
      message: 'Una reserva cancelada no puede pasar a confirmada.',
    });
  });

  it("answers 404 for another customer's booking", async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const bruno = await loggedInAgent(app, 'brunoDiaz');
    const id = await readyDraft(ana);

    const res = await confirm(bruno, id);

    expect(res.status).toBe(404);
  });
});
