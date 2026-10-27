import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/test-app';

const { app, db } = createTestApp();

afterAll(async () => {
  await db.destroy();
});

describe('GET /api/rooms', () => {
  it('lists every room with its size, capacity and hourly rate', async () => {
    const res = await request(app).get('/api/rooms');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: expect.any(Number),
        name: 'Sala Andes',
        size: 'small',
        capacity: 4,
        hourlyRate: 40_000,
      },
      {
        id: expect.any(Number),
        name: 'Sala Caribe',
        size: 'small',
        capacity: 4,
        hourlyRate: 40_000,
      },
      {
        id: expect.any(Number),
        name: 'Sala Pacífico',
        size: 'medium',
        capacity: 8,
        hourlyRate: 70_000,
      },
      {
        id: expect.any(Number),
        name: 'Sala Amazonas',
        size: 'medium',
        capacity: 8,
        hourlyRate: 70_000,
      },
      {
        id: expect.any(Number),
        name: 'Sala Orinoco',
        size: 'large',
        capacity: 16,
        hourlyRate: 120_000,
      },
    ]);
  });
});
