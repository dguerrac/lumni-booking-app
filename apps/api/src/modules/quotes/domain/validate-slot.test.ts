import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { validateSlot } from './validate-slot';

// Fixed "now": Monday 2 Nov 2026, 08:00 in Bogotá.
// Calendar used below: Sat 31 Oct · Sun 1 Nov · Mon 2 · Tue 3 · Sat 7 · Sun 8.
const now = DateTime.fromISO('2026-11-02T08:00', { zone: 'America/Bogota' });

const codesFor = (date: string, startTime: string, durationHours: number) =>
  validateSlot({ date, startTime, durationHours }, now).map((v) => v.code);

describe('validateSlot accepts', () => {
  it.each([
    ['a regular Tuesday hour', '2026-11-03', '09:00', 1],
    ['the opening time', '2026-11-03', '07:00', 1],
    ['a booking that ends exactly at closing', '2026-11-03', '11:00', 10],
    ['a half-hour start and duration', '2026-11-03', '09:30', 2.5],
    ['Saturday 19:00 Bogotá, which is already Sunday in UTC', '2026-11-07', '19:00', 2],
    ['later today', '2026-11-02', '08:30', 1],
  ])('%s', (_case, date, startTime, duration) => {
    expect(codesFor(date, startTime, duration)).toEqual([]);
  });
});

describe('validateSlot rejects', () => {
  it.each([
    ['Sunday', '2026-11-08', '10:00', 1, 'CLOSED_DAY'],
    ['a start before opening', '2026-11-03', '06:30', 1, 'BEFORE_OPENING'],
    ['an end after closing', '2026-11-03', '20:30', 1, 'AFTER_CLOSING'],
    ['a start not on :00 or :30', '2026-11-03', '09:15', 1, 'NOT_ON_SLOT_BOUNDARY'],
    ['half an hour', '2026-11-03', '09:00', 0.5, 'INVALID_DURATION'],
    ['ten and a half hours', '2026-11-03', '07:00', 10.5, 'INVALID_DURATION'],
    ['a duration not in 30-minute blocks', '2026-11-03', '09:00', 1.25, 'INVALID_DURATION'],
    ['a past day', '2026-10-31', '10:00', 1, 'IN_PAST'],
    ['earlier today', '2026-11-02', '07:30', 1, 'IN_PAST'],
    ['a start equal to now', '2026-11-02', '08:00', 1, 'IN_PAST'],
    ['a date that does not exist', '2026-02-30', '10:00', 1, 'INVALID_DATE'],
    ['a time that does not exist', '2026-11-03', '24:00', 1, 'INVALID_TIME'],
  ])('%s', (_case, date, startTime, duration, code) => {
    expect(codesFor(date, startTime, duration)).toEqual([code]);
  });

  it('reports every broken rule at once', () => {
    const codes = codesFor('2026-11-08', '06:15', 0.5);

    expect(codes).toHaveLength(3);
    expect(codes).toEqual(
      expect.arrayContaining(['CLOSED_DAY', 'NOT_ON_SLOT_BOUNDARY', 'INVALID_DURATION']),
    );
  });

  it('gives a Spanish message for each violation', () => {
    const [violation] = validateSlot(
      { date: '2026-11-03', startTime: '20:30', durationHours: 1 },
      now,
    );

    expect(violation?.message).toBe('La reserva debe terminar a más tardar a las 21:00.');
  });
});
