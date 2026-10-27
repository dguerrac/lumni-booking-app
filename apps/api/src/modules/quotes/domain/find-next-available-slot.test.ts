import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { findNextAvailableSlot } from './find-next-available-slot';

// Fixed "now": Monday 2 Nov 2026, 08:00 in Bogotá. Bookings below are on Tuesday 3 Nov.
const now = DateTime.fromISO('2026-11-02T08:00', { zone: 'America/Bogota' });
const TUESDAY = '2026-11-03';

const busy = (start: string, end: string, date = TUESDAY) => ({
  startsAt: new Date(`${date}T${start}:00-05:00`),
  endsAt: new Date(`${date}T${end}:00-05:00`),
});

const next = (
  startTime: string,
  durationHours: number,
  bookings: ReturnType<typeof busy>[],
  date = TUESDAY,
) => findNextAvailableSlot({ date, startTime, durationHours }, bookings, now);

describe('findNextAvailableSlot', () => {
  it('suggests the slot that starts exactly when a busy morning ends', () => {
    expect(next('08:00', 1, [busy('07:00', '12:00')])).toEqual({
      startTime: '12:00',
      endTime: '13:00',
    });
  });

  it('skips a gap that is too short for the duration', () => {
    const bookings = [busy('10:00', '11:00'), busy('12:00', '15:00')];

    expect(next('10:00', 2, bookings)).toEqual({ startTime: '15:00', endTime: '17:00' });
  });

  it('only looks later than the requested start, never earlier', () => {
    expect(next('10:00', 1, [busy('10:00', '12:00')])).toEqual({
      startTime: '12:00',
      endTime: '13:00',
    });
  });

  it('keeps the same duration, including half hours', () => {
    expect(next('09:00', 2.5, [busy('09:00', '10:30')])).toEqual({
      startTime: '10:30',
      endTime: '13:00',
    });
  });

  it('starts from the next :00 or :30 when the request is off the grid', () => {
    expect(next('09:15', 1, [])).toEqual({ startTime: '09:30', endTime: '10:30' });
  });

  it('skips times that are already past today', () => {
    expect(next('07:00', 1, [], '2026-11-02')).toEqual({ startTime: '08:30', endTime: '09:30' });
  });

  it('returns null when nothing fits before closing', () => {
    expect(next('13:00', 2, [busy('14:00', '21:00')])).toBeNull();
  });

  it('returns null when the day is fully booked', () => {
    expect(next('09:00', 1, [busy('07:00', '21:00')])).toBeNull();
  });

  it('returns null on a closed day', () => {
    expect(next('10:00', 1, [], '2026-11-08')).toBeNull();
  });
});
