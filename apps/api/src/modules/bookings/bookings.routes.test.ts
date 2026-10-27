import { sql } from 'kysely';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { confirmedBooking, getSeedIds, insertBooking } from '../../test/factories';
import { createTestApp, loggedInAgent } from '../../test/test-app';

// "now" is frozen at Monday 2 Nov 2026, 08:00 Bogotá (see test-app.ts).
const TUESDAY = '2026-11-03';
const SUNDAY = '2026-11-08';

const { app, db } = createTestApp();
let smallRoomId: number; // Sala Andes, 4 people
let mediumRoomId: number; // Sala Pacífico, 8 people
let anaId: number;

beforeAll(async () => {
  const ids = await getSeedIds(db);
  smallRoomId = ids.roomIds[0]!;
  mediumRoomId = ids.roomIds[2]!;
  anaId = ids.customerAId;
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(async () => {
  await sql`TRUNCATE bookings CASCADE`.execute(db);
});

const slot = (overrides = {}) => ({
  roomId: smallRoomId,
  date: TUESDAY,
  startTime: '09:00',
  durationHours: 2,
  ...overrides,
});

describe('POST /api/bookings (create draft)', () => {
  it('creates a draft for the logged-in customer with their contact data prefilled', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');

    const res = await ana.post('/api/bookings').send(slot());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      status: 'draft',
      currentStep: 1,
      roomId: smallRoomId,
      date: TUESDAY,
      startTime: '09:00',
      durationHours: 2,
      partySize: null,
      contact: {
        name: 'Ana Gómez',
        email: 'cliente.a@lumni.test',
        phone: '3001234567',
        company: 'Andes Studio',
      },
      extras: {},
      price: null,
      confirmedAt: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('requires a session', async () => {
    const res = await request(app).post('/api/bookings').send(slot());

    expect(res.status).toBe(401);
  });

  it('rejects a slot that breaks the opening rules, with the reasons', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');

    const res = await ana.post('/api/bookings').send(slot({ date: SUNDAY }));

    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      code: 'SLOT_NOT_VALID',
      details: [{ code: 'CLOSED_DAY', message: 'El coworking no abre ese día.' }],
    });
  });

  it('returns 404 for a room that does not exist', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');

    const res = await ana.post('/api/bookings').send(slot({ roomId: 9999 }));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
  });

  it('ignores a customer id sent in the body', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');

    const res = await ana.post('/api/bookings').send({ ...slot(), customerId: 2 });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/bookings when the customer already has a draft', () => {
  it('reuses that draft: new slot, same contact data, extras cleared, back to step 1', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const first = await ana.post('/api/bookings').send(slot());
    await ana.patch(`/api/bookings/${first.body.id}`).send({
      step: 1,
      data: {
        contactName: 'Ana G.',
        contactEmail: 'ana@andes.studio',
        contactPhone: '3001234567',
        partySize: 3,
      },
    });
    await ana.patch(`/api/bookings/${first.body.id}`).send({ step: 3, data: { projector: true } });

    const second = await ana
      .post('/api/bookings')
      .send(slot({ roomId: mediumRoomId, startTime: '15:00' }));

    expect(second.status).toBe(201);
    expect(second.body).toMatchObject({
      id: first.body.id,
      roomId: mediumRoomId,
      startTime: '15:00',
      currentStep: 1,
      partySize: 3,
      contact: { name: 'Ana G.', email: 'ana@andes.studio' },
      extras: {},
    });
  });

  it('keeps one draft even when two "Reservar" clicks arrive at once', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');

    const [a, b] = await Promise.all([
      ana.post('/api/bookings').send(slot()),
      ana.post('/api/bookings').send(slot({ startTime: '15:00' })),
    ]);

    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body.id).toBe(b.body.id);
    const drafts = await db
      .selectFrom('bookings')
      .select('id')
      .where('customer_id', '=', anaId)
      .where('status', '=', 'draft')
      .execute();
    expect(drafts).toHaveLength(1);
  });
});

describe('GET /api/bookings/draft/current', () => {
  it("returns the customer's most recently updated draft", async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    await ana.post('/api/bookings').send(slot());
    const latest = await ana.post('/api/bookings').send(slot({ startTime: '15:00' }));

    const res = await ana.get('/api/bookings/draft/current');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: latest.body.id, startTime: '15:00' });
  });

  it("never returns another customer's draft", async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const bruno = await loggedInAgent(app, 'brunoDiaz');
    await ana.post('/api/bookings').send(slot());

    const res = await bruno.get('/api/bookings/draft/current');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NO_DRAFT');
  });
});

describe('GET /api/bookings/:id', () => {
  it('returns your own booking', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const created = await ana.post('/api/bookings').send(slot());

    const res = await ana.get(`/api/bookings/${created.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  it("answers 404, not 403, for another customer's booking (doesn't reveal it exists)", async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const bruno = await loggedInAgent(app, 'brunoDiaz');
    const created = await ana.post('/api/bookings').send(slot());

    const res = await bruno.get(`/api/bookings/${created.body.id}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BOOKING_NOT_FOUND');
  });

  it('answers 404 for an id that is not a UUID', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');

    const res = await ana.get('/api/bookings/123');

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/bookings/:id (save a wizard step)', () => {
  const contact = {
    contactName: 'Ana Gómez',
    contactEmail: 'ana@andes.studio',
    contactPhone: '300 123 4567',
    company: 'Andes Studio',
    partySize: 3,
  };

  async function draftOf(agent: Awaited<ReturnType<typeof loggedInAgent>>, overrides = {}) {
    const res = await agent.post('/api/bookings').send(slot(overrides));
    return res.body.id as string;
  }

  it('step 1 saves the contact data and party size and moves on to step 2', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await draftOf(ana);

    const res = await ana.patch(`/api/bookings/${id}`).send({ step: 1, data: contact });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      currentStep: 2,
      partySize: 3,
      contact: {
        name: 'Ana Gómez',
        email: 'ana@andes.studio',
        phone: '300 123 4567',
        company: 'Andes Studio',
      },
    });
  });

  it('step 1 rejects a party larger than the room', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await draftOf(ana);

    const res = await ana
      .patch(`/api/bookings/${id}`)
      .send({ step: 1, data: { ...contact, partySize: 6 } });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      code: 'DRAFT_NOT_VALID',
      details: [{ code: 'PARTY_TOO_LARGE' }],
    });
  });

  it('step 1 rejects malformed contact data with 400', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await draftOf(ana);

    const res = await ana
      .patch(`/api/bookings/${id}`)
      .send({ step: 1, data: { ...contact, contactEmail: 'no-es-un-correo' } });

    expect(res.status).toBe(400);
  });

  it('step 2 changes the room and slot and moves on to step 3', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await draftOf(ana);
    await ana.patch(`/api/bookings/${id}`).send({ step: 1, data: contact });

    const res = await ana.patch(`/api/bookings/${id}`).send({
      step: 2,
      data: slot({ roomId: mediumRoomId, startTime: '14:30', durationHours: 3.5 }),
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      currentStep: 3,
      roomId: mediumRoomId,
      startTime: '14:30',
      durationHours: 3.5,
    });
  });

  it('step 2 rejects a slot that breaks the opening rules', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await draftOf(ana);

    const res = await ana
      .patch(`/api/bookings/${id}`)
      .send({ step: 2, data: slot({ startTime: '20:30', durationHours: 1 }) });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([expect.objectContaining({ code: 'AFTER_CLOSING' })]);
  });

  it('step 2 rejects a room too small for the party', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await draftOf(ana, { roomId: mediumRoomId });
    await ana.patch(`/api/bookings/${id}`).send({ step: 1, data: { ...contact, partySize: 6 } });

    const res = await ana
      .patch(`/api/bookings/${id}`)
      .send({ step: 2, data: slot({ roomId: smallRoomId }) });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([expect.objectContaining({ code: 'PARTY_TOO_LARGE' })]);
  });

  it('step 3 saves the extras', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await draftOf(ana);
    await ana.patch(`/api/bookings/${id}`).send({ step: 1, data: contact });

    const res = await ana
      .patch(`/api/bookings/${id}`)
      .send({ step: 3, data: { projector: true, coffee: 3 } });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ currentStep: 3, extras: { projector: true, coffee: 3 } });
  });

  it('step 3 rejects more coffees than people', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await draftOf(ana);
    await ana.patch(`/api/bookings/${id}`).send({ step: 1, data: contact });

    const res = await ana.patch(`/api/bookings/${id}`).send({ step: 3, data: { coffee: 5 } });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([
      expect.objectContaining({ code: 'COFFEE_EXCEEDS_PARTY' }),
    ]);
  });

  it('editing an earlier step does not move the saved progress back', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await draftOf(ana);
    await ana.patch(`/api/bookings/${id}`).send({ step: 1, data: contact });
    await ana.patch(`/api/bookings/${id}`).send({ step: 2, data: slot() });

    const res = await ana
      .patch(`/api/bookings/${id}`)
      .send({ step: 1, data: { ...contact, partySize: 2 } });

    expect(res.body.currentStep).toBe(3);
  });

  it("answers 404 for another customer's draft", async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const bruno = await loggedInAgent(app, 'brunoDiaz');
    const id = await draftOf(ana);

    const res = await bruno.patch(`/api/bookings/${id}`).send({ step: 1, data: contact });

    expect(res.status).toBe(404);
  });

  it('answers 409 when the booking is no longer a draft', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const confirmed = await insertBooking(
      db,
      confirmedBooking({
        customer_id: anaId,
        room_id: smallRoomId,
        starts_at: '2026-11-03T09:00:00-05:00',
        ends_at: '2026-11-03T11:00:00-05:00',
      }),
    );

    const res = await ana.patch(`/api/bookings/${confirmed.id}`).send({ step: 1, data: contact });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_NOT_EDITABLE');
  });

  it('rejects a step that does not exist', async () => {
    const ana = await loggedInAgent(app, 'anaGomez');
    const id = await draftOf(ana);

    const res = await ana.patch(`/api/bookings/${id}`).send({ step: 4, data: {} });

    expect(res.status).toBe(400);
  });
});
