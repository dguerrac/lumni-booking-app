import type { BookingStatus } from '@lumni/shared';
import { type Insertable, type Kysely, type Selectable, sql, type Updateable } from 'kysely';
import type { BookingsTable, Database } from '../../db/types';
import { sourcesFor } from './domain/state-machine';

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

/**
 * Creates the customer's draft, or, if they already have one (unique index
 * one_draft_per_customer), moves it to the new slot: same row, contact data
 * and party size kept, extras cleared, back to step 1. One atomic statement,
 * so concurrent calls can't create two drafts.
 */
export function upsertDraft(db: Kysely<Database>, draft: Insertable<BookingsTable>) {
  return db
    .insertInto('bookings')
    .values(draft)
    .onConflict((oc) =>
      oc
        .column('customer_id')
        .where('status', '=', 'draft')
        .doUpdateSet({
          room_id: draft.room_id,
          starts_at: draft.starts_at,
          ends_at: draft.ends_at,
          extras: sql`'{}'::jsonb`,
          current_step: 1,
          updated_at: sql`now()`,
        }),
    )
    .returningAll()
    .executeTakeFirstOrThrow();
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

/**
 * draft → confirmed, with the price frozen in the same statement.
 *
 * - WHERE status IN (allowed sources) applies the state machine atomically.
 *   Two concurrent confirms of the same row serialize on its row lock; the
 *   second one re-checks the WHERE after the first commits, matches nothing
 *   and returns undefined.
 * - If another confirmed booking already holds this room and time, the
 *   no_overlap_confirmed constraint raises 23P01 here.
 */
export function markConfirmed(
  db: Kysely<Database>,
  { id, customerId }: { id: string; customerId: number },
  price: { base: number; discount: number; surcharge: number; extrasTotal: number; total: number },
) {
  return db
    .updateTable('bookings')
    .set({
      status: 'confirmed',
      confirmed_at: sql<Date>`now()`,
      updated_at: sql<Date>`now()`,
      base: price.base,
      discount: price.discount,
      surcharge: price.surcharge,
      extras_total: price.extrasTotal,
      total: price.total,
    })
    .where('id', '=', id)
    .where('customer_id', '=', customerId)
    .where('status', 'in', sourcesFor('confirmed'))
    .returningAll()
    .executeTakeFirst();
}

/**
 * → cancelled, only from the given states (the caller's policy: a customer may
 * only discard a draft). Same pattern as markConfirmed: the WHERE clause makes
 * the check and the write one atomic step.
 */
export function markCancelled(
  db: Kysely<Database>,
  { id, customerId }: { id: string; customerId: number },
  reason: string,
  from: BookingStatus[],
) {
  return db
    .updateTable('bookings')
    .set({
      status: 'cancelled',
      cancel_reason: reason,
      cancelled_at: sql<Date>`now()`,
      updated_at: sql<Date>`now()`,
    })
    .where('id', '=', id)
    .where('customer_id', '=', customerId)
    .where('status', 'in', from)
    .returningAll()
    .executeTakeFirst();
}
