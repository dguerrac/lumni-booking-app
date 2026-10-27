import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { releaseTogether } from '../../test/concurrency';
import { confirmedBooking, getSeedIds, insertBooking } from '../../test/factories';
import { createTestApp, loggedInAgent } from '../../test/test-app';

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

async function readyDraft(agent: Agent) {
  const created = await agent
    .post('/api/bookings')
    .send({ roomId: smallRoomId, date: TUESDAY, startTime: '09:00', durationHours: 2 });
  const id = created.body.id as string;
  await agent.patch(`/api/bookings/${id}`).send({
    step: 1,
    data: {
      contactName: 'Ana Gómez',
      contactEmail: 'ana@andes.studio',
      contactPhone: '3001234567',
      partySize: 3,
    },
  });
  return id;
}

const cancel = (agent: Agent, id: string) => agent.post(`/api/bookings/${id}/cancel`);
const confirm = (agent: Agent, id: string) => agent.post(`/api/bookings/${id}/confirm`);
const statusOf = async (id: string) =>
  (await db.selectFrom('bookings').select('status').where('id', '=', id).executeTakeFirstOrThrow())
    .status;

describe('POST /api/bookings/:id/cancel (customer discards a draft)', () => {
  it('cancels your own draft and records why', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await readyDraft(ana);

    const res = await cancel(ana, id);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    const row = await db.selectFrom('bookings').selectAll().where('id', '=', id).executeTakeFirst();
    expect(row).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'Borrador descartado por el cliente',
    });
  });

  it('frees the customer to start a new draft', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await readyDraft(ana);
    await cancel(ana, id);

    const next = await ana
      .post('/api/bookings')
      .send({ roomId: smallRoomId, date: TUESDAY, startTime: '15:00', durationHours: 1 });

    expect(next.status).toBe(201);
    expect(next.body.id).not.toBe(id);
  });

  it('does not let a customer cancel a confirmed booking (only the admin can)', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const confirmed = await insertBooking(
      db,
      confirmedBooking({
        customer_id: anaId,
        room_id: smallRoomId,
        starts_at: `${TUESDAY}T09:00:00-05:00`,
        ends_at: `${TUESDAY}T11:00:00-05:00`,
      }),
    );

    const res = await cancel(ana, confirmed.id);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_NOT_EDITABLE');
    expect(await statusOf(confirmed.id)).toBe('confirmed');
  });

  it("answers 404 for another customer's draft", async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const bruno = await loggedInAgent(app, 'brunoDiaz');
    const id = await readyDraft(ana);

    const res = await cancel(bruno, id);

    expect(res.status).toBe(404);
    expect(await statusOf(id)).toBe('draft');
  });
});

describe('confirm and cancel racing on the same draft', () => {
  it('a cancel that arrives first wins: the late confirm gets 409, it never overwrites it', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await readyDraft(ana);

    const [cancelled, confirmed] = await releaseTogether(
      db,
      [id],
      [() => cancel(ana, id), () => confirm(ana, id)],
    );

    expect(cancelled.status).toBe(200);
    expect(confirmed.status).toBe(409);
    expect(confirmed.body.error.code).toBe('INVALID_TRANSITION');
    expect(await statusOf(id)).toBe('cancelled');
  });

  it('a confirm that arrives first wins: the late cancel gets 409', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await readyDraft(ana);

    const [confirmed, cancelled] = await releaseTogether(
      db,
      [id],
      [() => confirm(ana, id), () => cancel(ana, id)],
    );

    expect(confirmed.status).toBe(200);
    expect(cancelled.status).toBe(409);
    expect(await statusOf(id)).toBe('confirmed');
  });
});
