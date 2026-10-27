import type { Insertable, Kysely } from 'kysely';
import type { BookingsTable, Database } from '../db/types';

/** Ids of the seed data loaded by global-setup. */
export async function getSeedIds(db: Kysely<Database>) {
  const customerA = await db
    .selectFrom('users')
    .select('id')
    .where('email', '=', 'cliente.a@lumni.test')
    .executeTakeFirstOrThrow();
  const customerB = await db
    .selectFrom('users')
    .select('id')
    .where('email', '=', 'cliente.b@lumni.test')
    .executeTakeFirstOrThrow();
  const rooms = await db.selectFrom('rooms').select('id').orderBy('id').execute();

  return {
    customerAId: customerA.id,
    customerBId: customerB.id,
    roomIds: rooms.map((r) => r.id),
  };
}

/** A valid confirmed booking; override any column. Times are ISO strings with offset. */
export function confirmedBooking(
  booking: Pick<Insertable<BookingsTable>, 'customer_id' | 'room_id' | 'starts_at' | 'ends_at'> &
    Partial<Insertable<BookingsTable>>,
): Insertable<BookingsTable> {
  return { status: 'confirmed', total: 80_000, confirmed_at: new Date(), ...booking };
}

export function insertBooking(db: Kysely<Database>, booking: Insertable<BookingsTable>) {
  return db.insertInto('bookings').values(booking).returningAll().executeTakeFirstOrThrow();
}
