import { type Kysely, sql } from 'kysely';

// Transactional outbox for Part 2.1. Confirming a booking inserts its email
// here in the same transaction, so either both exist or neither does (no
// confirmed booking without its email, no email for a booking that didn't
// commit). A background worker sends the rows later.
//
// UNIQUE (booking_id, kind): one confirmation email per booking, enforced by
// the database even with concurrent confirms or worker retries.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE email_outbox (
      id              bigserial PRIMARY KEY,
      booking_id      uuid NOT NULL REFERENCES bookings ON DELETE CASCADE,
      kind            text NOT NULL,
      to_email        text NOT NULL,
      payload         jsonb NOT NULL,
      status          text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'retrying', 'sending', 'sent', 'failed')),
      attempts        int NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      next_attempt_at timestamptz NOT NULL DEFAULT now(),
      locked_until    timestamptz,
      last_error      text,
      sent_at         timestamptz,
      created_at      timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT one_email_per_kind UNIQUE (booking_id, kind)
    )
  `.execute(db);

  // The worker's query: rows due now, in order. Partial, so sent and failed
  // rows (the vast majority over time) don't weigh on it.
  await sql`
    CREATE INDEX email_outbox_due ON email_outbox (next_attempt_at)
    WHERE status IN ('pending', 'retrying', 'sending')
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE email_outbox`.execute(db);
}
