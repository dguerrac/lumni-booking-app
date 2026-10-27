import { type Insertable, type Kysely, type Selectable, sql, type Updateable } from 'kysely';
import type { BookingsTable, Database } from '../../db/types';

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

export type BookingRow = Selectable<BookingsTable>;

export function insertDraft(db: Kysely<Database>, draft: Insertable<BookingsTable>) {
  return db.insertInto('bookings').values(draft).returningAll().executeTakeFirstOrThrow();
}

/** Scoped to the customer: someone else's booking is simply not found. */
export function findCustomerBooking(db: Kysely<Database>, id: string, customerId: number) {
  return db
    .selectFrom('bookings')
    .selectAll()
    .where('id', '=', id)
    .where('customer_id', '=', customerId)
    .executeTakeFirst();
}

export function findLatestDraft(db: Kysely<Database>, customerId: number) {
  return db
    .selectFrom('bookings')
    .selectAll()
    .where('customer_id', '=', customerId)
    .where('status', '=', 'draft')
    .orderBy('updated_at', 'desc')
    .orderBy('created_at', 'desc')
    .limit(1)
    .executeTakeFirst();
}

/**
 * Applies one wizard step, only while the booking is still a draft of this
 * customer. Progress never moves back (GREATEST). undefined = nothing updated.
 */
export function updateDraft(
  db: Kysely<Database>,
  { id, customerId }: { id: string; customerId: number },
  changes: Updateable<BookingsTable>,
  reachedStep: number,
) {
  return db
    .updateTable('bookings')
    .set({
      ...changes,
      current_step: sql<number>`GREATEST(current_step, ${reachedStep})`,
      updated_at: sql<Date>`now()`,
    })
    .where('id', '=', id)
    .where('customer_id', '=', customerId)
    .where('status', '=', 'draft')
    .returningAll()
    .executeTakeFirst();
}
