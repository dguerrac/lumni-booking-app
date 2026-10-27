import { type Kysely, sql } from 'kysely';

// A booking starts as a draft (wizard step 1), so most columns are nullable
// until confirmation. The CHECK constraints are the second line of defense
// behind Zod: even a buggy service cannot store an invalid confirmed booking.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE bookings (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id   int  NOT NULL REFERENCES users,
      room_id       int  REFERENCES rooms,
      starts_at     timestamptz,
      ends_at       timestamptz,
      party_size    int CHECK (party_size > 0),
      contact_name  text,
      contact_email text,
      contact_phone text,
      company       text,
      extras        jsonb NOT NULL DEFAULT '{}',
      status        text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'confirmed', 'completed', 'cancelled')),
      current_step  smallint NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 3),

      -- Price snapshot in integer COP, frozen at confirmation
      subtotal      int CHECK (subtotal >= 0),
      discount      int CHECK (discount >= 0),
      surcharge     int CHECK (surcharge >= 0),
      extras_total  int CHECK (extras_total >= 0),
      total         int CHECK (total >= 0),

      cancel_reason text,
      confirmed_at  timestamptz,
      cancelled_at  timestamptz,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now(),

      CONSTRAINT slot_complete CHECK ((starts_at IS NULL) = (ends_at IS NULL)),
      CONSTRAINT slot_positive CHECK (ends_at > starts_at),
      CONSTRAINT confirmed_has_slot_and_price CHECK (
        status NOT IN ('confirmed', 'completed')
        OR (room_id IS NOT NULL AND starts_at IS NOT NULL AND total IS NOT NULL
            AND confirmed_at IS NOT NULL)
      ),
      CONSTRAINT cancelled_has_reason CHECK (
        status <> 'cancelled' OR (cancel_reason IS NOT NULL AND cancelled_at IS NOT NULL)
      )
    )
  `.execute(db);

  await sql`
    CREATE INDEX bookings_admin_list ON bookings (status, room_id, created_at DESC)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE bookings`.execute(db);
}
