import type { QuoteReason, QuoteRequest, QuoteResponse } from '@lumni/shared';
import type { Kysely } from 'kysely';
import type { DateTime } from 'luxon';
import type { Database } from '../../db/types';
import { NotFoundError } from '../../http/errors';
import { findBlockingBookings } from '../bookings/bookings.repository';
import { findRoomById } from '../rooms/rooms.repository';
import { findNextAvailableSlot } from './domain/find-next-available-slot';
import { priceQuote } from './domain/price-quote';
import { PRICING } from './domain/pricing-config';
import { overlapsAny, toSlotBounds } from './domain/slot-interval';
import { validateSlot } from './domain/validate-slot';

/**
 * Price + rules + availability for one slot. Rule violations are not errors:
 * the response says bookable: false and why, and suggests the next free slot.
 *
 * The availability read here is advisory; the no_overlap_confirmed constraint
 * is what prevents double booking at confirmation.
 */
export async function createQuote(
  db: Kysely<Database>,
  input: QuoteRequest,
  now: DateTime,
): Promise<QuoteResponse> {
  const room = await findRoomById(db, input.roomId);
  if (!room) throw new NotFoundError('ROOM_NOT_FOUND', 'La sala no existe.');

  const reasons: QuoteReason[] = validateSlot(input, now);
  const breakdown = priceQuote({ ...input, roomSize: room.size });
  const { start, end } = toSlotBounds(input);

  let nextAvailable: QuoteResponse['nextAvailable'] = null;

  if (start.isValid) {
    const dayStart = start.startOf('day');
    const busy = await findBlockingBookings(db, {
      roomId: room.id,
      from: dayStart.toJSDate(),
      to: dayStart.plus({ days: 1 }).toJSDate(),
    });

    if (overlapsAny(start, end, busy)) {
      reasons.push({ code: 'SLOT_TAKEN', message: 'La sala ya está reservada en ese horario.' });
    }
    if (reasons.length > 0) {
      nextAvailable = findNextAvailableSlot(input, busy, now);
    }
  }

  return {
    roomId: room.id,
    date: input.date,
    startTime: input.startTime,
    durationHours: input.durationHours,
    startsAt: start.isValid ? start.toISO() : null,
    endsAt: start.isValid ? end.toISO() : null,
    dayHours: start.isValid ? (PRICING.openingHours[start.weekday] ?? null) : null,
    breakdown,
    bookable: reasons.length === 0,
    reasons,
    nextAvailable,
  };
}
