import { DateTime, Interval } from 'luxon';
import { PRICING } from './pricing-config';
import { type SlotInput, validateSlot } from './validate-slot';

/** A time the room is taken. Same shape the bookings repository returns. */
export type BusyInterval = { startsAt: Date; endsAt: Date };

export type SuggestedSlot = { startTime: string; endTime: string };

/**
 * The first slot on the same day, strictly after the requested start, with the
 * same duration, that passes every rule in validateSlot and does not overlap a
 * busy interval. null when nothing fits.
 *
 * Pure: the busy intervals and "now" are passed in.
 */
export function findNextAvailableSlot(
  requested: SlotInput,
  busy: BusyInterval[],
  now: DateTime,
): SuggestedSlot | null {
  const { timeZone, slotStepMinutes } = PRICING;

  const requestedStart = DateTime.fromISO(`${requested.date}T${requested.startTime}`, {
    zone: timeZone,
  });
  if (!requestedStart.isValid) return null;

  const busyIntervals = busy.map((b) =>
    Interval.fromDateTimes(DateTime.fromJSDate(b.startsAt), DateTime.fromJSDate(b.endsAt)),
  );

  // First :00 or :30 strictly after the requested start (09:00 → 09:30, 09:15 → 09:30).
  const minutesIntoDay = requestedStart.hour * 60 + requestedStart.minute;
  const firstStep = (Math.floor(minutesIntoDay / slotStepMinutes) + 1) * slotStepMinutes;

  for (
    let candidate = requestedStart.startOf('day').plus({ minutes: firstStep });
    candidate.hasSame(requestedStart, 'day');
    candidate = candidate.plus({ minutes: slotStepMinutes })
  ) {
    const startTime = candidate.toFormat('HH:mm');
    const violations = validateSlot({ ...requested, startTime }, now);
    if (violations.length > 0) continue;

    const end = candidate.plus({ minutes: requested.durationHours * 60 });
    const slot = Interval.fromDateTimes(candidate, end);
    // Luxon's overlaps() is half-open, like the database constraint:
    // a slot starting exactly when a booking ends is free.
    if (busyIntervals.some((b) => b.overlaps(slot))) continue;

    return { startTime, endTime: end.toFormat('HH:mm') };
  }

  return null;
}
