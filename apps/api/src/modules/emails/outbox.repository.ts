import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';

/**
 * Queues an email. Must run inside the caller's transaction (pass the trx).
 * ON CONFLICT DO NOTHING: if this booking already has an email of this kind,
 * nothing happens; UNIQUE (booking_id, kind) makes a duplicate impossible.
 */
export function enqueueEmail(
  db: Kysely<Database>,
  email: { bookingId: string; kind: string; toEmail: string; payload: unknown },
) {
  return db
    .insertInto('email_outbox')
    .values({
      booking_id: email.bookingId,
      kind: email.kind,
      to_email: email.toEmail,
      payload: JSON.stringify(email.payload),
    })
    .onConflict((oc) => oc.columns(['booking_id', 'kind']).doNothing())
    .execute();
}
