import type { AdminBookingsQuery } from '@lumni/shared';
import { type Kysely, sql } from 'kysely';
import type { Database } from '../../db/types';
import { sourcesFor } from '../bookings/domain/state-machine';

/** Bookings joined with their customer and room. Every admin query starts here. */
function adminBookings(db: Kysely<Database>) {
  return db
    .selectFrom('bookings')
    .innerJoin('users', 'users.id', 'bookings.customer_id')
    .leftJoin('rooms', 'rooms.id', 'bookings.room_id');
}

function withFilters(
  db: Kysely<Database>,
  { status, roomId }: Pick<AdminBookingsQuery, 'status' | 'roomId'>,
) {
  let query = adminBookings(db);
  if (status) query = query.where('bookings.status', '=', status);
  if (roomId) query = query.where('bookings.room_id', '=', roomId);
  return query;
}

/**
 * One page, newest first (id breaks ties so pages never overlap). Offset
 * pagination is fine at this size and gives page numbers; with millions of
 * rows I'd switch to keyset pagination (WHERE created_at < :cursor).
 * The bookings_admin_list index (status, room_id, created_at DESC) serves it.
 */
export async function listAdminBookings(db: Kysely<Database>, query: AdminBookingsQuery) {
  const [rows, count] = await Promise.all([
    withFilters(db, query)
      .selectAll('bookings')
      .select([
        'users.name as customer_name',
        'users.email as customer_email',
        'rooms.name as room_name',
      ])
      .orderBy('bookings.created_at', 'desc')
      .orderBy('bookings.id', 'desc')
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)
      .execute(),
    withFilters(db, query)
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .executeTakeFirstOrThrow(),
  ]);
  return { rows, total: Number(count.total) };
}

export function findAdminBooking(db: Kysely<Database>, id: string) {
  return adminBookings(db)
    .selectAll('bookings')
    .select([
      'users.name as customer_name',
      'users.email as customer_email',
      'rooms.name as room_name',
    ])
    .where('bookings.id', '=', id)
    .executeTakeFirst();
}

export type AdminBookingRow = NonNullable<Awaited<ReturnType<typeof findAdminBooking>>>;

/**
 * Admin transitions. Like the customer ones, the allowed source states go in
 * the WHERE clause, so the check and the write are one atomic step. No
 * customer filter: the admin acts on anyone's booking.
 */
export function adminMarkCancelled(db: Kysely<Database>, id: string, reason: string) {
  return db
    .updateTable('bookings')
    .set({
      status: 'cancelled',
      cancel_reason: reason,
      cancelled_at: sql<Date>`now()`,
      updated_at: sql<Date>`now()`,
    })
    .where('id', '=', id)
    .where('status', 'in', sourcesFor('cancelled'))
    .returning('id')
    .executeTakeFirst();
}

/** Only bookings that already ended (ends_at ≤ now) can be marked completed. */
export function adminMarkCompleted(db: Kysely<Database>, id: string, now: Date) {
  return db
    .updateTable('bookings')
    .set({ status: 'completed', updated_at: sql<Date>`now()` })
    .where('id', '=', id)
    .where('status', 'in', sourcesFor('completed'))
    .where('ends_at', '<=', now)
    .returning('id')
    .executeTakeFirst();
}
