import type { DateTime } from 'luxon';
import { PRICING } from './pricing-config';
import { type BusyInterval, overlapsAny, toSlotBounds } from './slot-interval';
import { type SlotInput, validateSlot } from './validate-slot';

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
  const { slotStepMinutes } = PRICING;

  const { start: requestedStart } = toSlotBounds(requested);
  if (!requestedStart.isValid) return null;

  // First :00 or :30 strictly after the requested start (09:00 → 09:30, 09:15 → 09:30).
  const minutesIntoDay = requestedStart.hour * 60 + requestedStart.minute;
  const firstStep = (Math.floor(minutesIntoDay / slotStepMinutes) + 1) * slotStepMinutes;

  for (
    let candidate = requestedStart.startOf('day').plus({ minutes: firstStep });
    candidate.hasSame(requestedStart, 'day');
    candidate = candidate.plus({ minutes: slotStepMinutes })
  ) {
    const startTime = candidate.toFormat('HH:mm');
    if (validateSlot({ ...requested, startTime }, now).length > 0) continue;

    const end = candidate.plus({ minutes: requested.durationHours * 60 });
    if (overlapsAny(candidate, end, busy)) continue;

    return { startTime, endTime: end.toFormat('HH:mm') };
  }

  return null;
}
