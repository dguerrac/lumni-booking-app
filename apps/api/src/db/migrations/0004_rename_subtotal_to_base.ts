import { type Kysely, sql } from 'kysely';

// The price breakdown calls the room price `base` (Part 1 spec: base,
// discount, surcharge, total). One name for one concept, everywhere.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE bookings RENAME COLUMN subtotal TO base`.execute(db);
  await sql`ALTER TABLE bookings RENAME CONSTRAINT bookings_subtotal_check TO bookings_base_check`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE bookings RENAME CONSTRAINT bookings_base_check TO bookings_subtotal_check`.execute(
    db,
  );
  await sql`ALTER TABLE bookings RENAME COLUMN base TO subtotal`.execute(db);
}
