import { DateTime, Interval } from 'luxon';
import { PRICING } from './pricing-config';

/** A time the room is taken. Same shape the bookings repository returns. */
export type BusyInterval = { startsAt: Date; endsAt: Date };

/** Start and end of a requested slot, read in Bogotá. Check start.isValid before using. */
export function toSlotBounds(slot: { date: string; startTime: string; durationHours: number }) {
  const start = DateTime.fromISO(`${slot.date}T${slot.startTime}`, { zone: PRICING.timeZone });
  return { start, end: start.plus({ minutes: slot.durationHours * 60 }) };
}

/**
 * Half-open overlap, like the no_overlap_confirmed constraint: a slot that
 * starts exactly when a booking ends is free.
 */
export function overlapsAny(start: DateTime, end: DateTime, busy: BusyInterval[]): boolean {
  const slot = Interval.fromDateTimes(start, end);
  return busy.some((b) =>
    Interval.fromDateTimes(DateTime.fromJSDate(b.startsAt), DateTime.fromJSDate(b.endsAt)).overlaps(
      slot,
    ),
  );
}
