import { type Kysely, sql } from 'kysely';

// The guarantee against double booking. Two transactions confirming the same
// room and time cannot both succeed: PostgreSQL checks this atomically and
// raises 23P01 (exclusion_violation) for the second one.
//
// - btree_gist lets a GiST index combine "=" on room_id with "&&" on a range.
// - '[)' is half-open: 10:00–12:00 and 12:00–14:00 do not overlap.
// - Only confirmed and completed bookings block a slot; drafts never do.
//   The confirmed_has_slot_and_price CHECK guarantees starts_at is not NULL
//   here (a NULL bound would make the range infinite).
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS btree_gist`.execute(db);

  await sql`
    ALTER TABLE bookings ADD CONSTRAINT no_overlap_confirmed
      EXCLUDE USING gist (room_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
      WHERE (status IN ('confirmed', 'completed'))
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE bookings DROP CONSTRAINT no_overlap_confirmed`.execute(db);
}
