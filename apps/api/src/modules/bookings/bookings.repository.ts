import { type Kysely, sql } from 'kysely';
import type { Database } from '../../db/types';

export type BlockingBooking = { id: string; startsAt: Date; endsAt: Date };

/**
 * Confirmed or completed bookings of a room that overlap [from, to).
 *
 * Uses the same expression and the same status filter as the
 * no_overlap_confirmed constraint (migration 0003), so PostgreSQL can answer
 * it from that constraint's GiST index, and "busy" means exactly what the
 * constraint enforces.
 *
 * This read is advisory (to show availability and suggest a slot); the
 * constraint is what actually prevents a double booking.
 */
export async function findBlockingBookings(
  db: Kysely<Database>,
  { roomId, from, to }: { roomId: number; from: Date; to: Date },
): Promise<BlockingBooking[]> {
  const rows = await db
    .selectFrom('bookings')
    .select(['id', 'starts_at', 'ends_at'])
    .where('room_id', '=', roomId)
    .where('status', 'in', ['confirmed', 'completed'])
    .where(sql<boolean>`tstzrange(starts_at, ends_at, '[)') && tstzrange(${from}, ${to}, '[)')`)
    .orderBy('starts_at')
    .execute();

  // The confirmed_has_slot_and_price CHECK guarantees both are set for
  // confirmed and completed bookings.
  return rows.map((row) => ({ id: row.id, startsAt: row.starts_at!, endsAt: row.ends_at! }));
}
