import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { releaseTogether } from '../../test/concurrency';
import { getSeedIds } from '../../test/factories';
import { createTestApp, loggedInAgent } from '../../test/test-app';

// Part 2.1: confirming a booking enqueues its confirmation email in the same
// transaction (transactional outbox). One email per confirmed booking, whatever
// happens: double clicks, concurrent confirms, races between customers.

const TUESDAY = '2026-11-03';
const { app, db } = createTestApp();
let smallRoomId: number;

type Agent = Awaited<ReturnType<typeof loggedInAgent>>;

beforeAll(async () => {
  smallRoomId = (await getSeedIds(db)).roomIds[0]!;
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(async () => {
  await sql`TRUNCATE bookings CASCADE`.execute(db);
});

async function readyDraft(agent: Agent, contactEmail: string) {
  const created = await agent
    .post('/api/bookings')
    .send({ roomId: smallRoomId, date: TUESDAY, startTime: '09:00', durationHours: 2 });
  const id = created.body.id as string;
  await agent.patch(`/api/bookings/${id}`).send({
    step: 1,
    data: { contactName: 'Ana Gómez', contactEmail, contactPhone: '3001234567', partySize: 3 },
  });
  await agent.patch(`/api/bookings/${id}`).send({ step: 3, data: { projector: true } });
  return id;
}

const confirm = (agent: Agent, id: string) => agent.post(`/api/bookings/${id}/confirm`);
const outbox = () => db.selectFrom('email_outbox').selectAll().orderBy('id').execute();

describe('confirmation email outbox', () => {
  it('confirming enqueues one pending email to the contact, with what the email needs', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await readyDraft(ana, 'ana@andes.studio');

    await confirm(ana, id);

    expect(await outbox()).toEqual([
      expect.objectContaining({
        booking_id: id,
        kind: 'booking_confirmed',
        to_email: 'ana@andes.studio',
        status: 'pending',
        attempts: 0,
        sent_at: null,
        payload: {
          contactName: 'Ana Gómez',
          roomName: 'Sala Andes',
          date: TUESDAY,
          startTime: '09:00',
          endTime: '11:00',
          partySize: 3,
          extras: { projector: true },
          price: { base: 80_000, discount: 0, surcharge: 0, extrasTotal: 30_000, total: 110_000 },
        },
      }),
    ]);
  });

  it('answers the confirm without sending anything: the email is only queued', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await readyDraft(ana, 'ana@andes.studio');

    const res = await confirm(ana, id);

    expect(res.status).toBe(200);
    const [email] = await outbox();
    expect(email).toMatchObject({ status: 'pending', attempts: 0 });
  });

  it('confirming twice still queues a single email', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await readyDraft(ana, 'ana@andes.studio');

    await confirm(ana, id);
    await confirm(ana, id);

    expect(await outbox()).toHaveLength(1);
  });

  it('two confirms of the same draft at the same time still queue a single email', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await readyDraft(ana, 'ana@andes.studio');

    await releaseTogether(db, [id], [() => confirm(ana, id), () => confirm(ana, id)]);

    expect(await outbox()).toHaveLength(1);
  });

  it('when two customers race for a slot, only the winner gets an email', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const bruno = await loggedInAgent(app, 'brunoDiaz');
    const anaDraft = await readyDraft(ana, 'ana@andes.studio');
    const brunoDraft = await readyDraft(bruno, 'bruno@lumni.test');

    const [anaRes, brunoRes] = await releaseTogether(
      db,
      [anaDraft, brunoDraft],
      [() => confirm(ana, anaDraft), () => confirm(bruno, brunoDraft)],
    );

    const winner = anaRes.status === 200 ? anaDraft : brunoDraft;
    expect([anaRes.status, brunoRes.status].sort()).toEqual([200, 409]);
    expect((await outbox()).map((e) => e.booking_id)).toEqual([winner]);
  });

  it('a draft that is discarded queues no email', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await readyDraft(ana, 'ana@andes.studio');

    await ana.post(`/api/bookings/${id}/cancel`);

    expect(await outbox()).toEqual([]);
  });
});
