import { type Kysely, sql } from 'kysely';
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

/**
 * Claims up to `limit` due emails for this worker, in one short transaction:
 * - due: pending/retrying whose time has come, or "sending" whose lease
 *   expired (the worker that claimed it crashed);
 * - FOR UPDATE SKIP LOCKED: rows another worker is claiming right now are
 *   skipped, not waited for, so several workers never get the same row;
 * - each claimed row becomes "sending" with a lease (locked_until) and counts
 *   the attempt now, so an email that keeps crashing workers still runs out
 *   of attempts.
 * The transaction ends before any email is sent: no transaction is held open
 * during network I/O.
 */
export function claimDueEmails(
  db: Kysely<Database>,
  now: Date,
  limit: number,
  leaseSeconds: number,
) {
  return db.transaction().execute(async (trx) => {
    const due = await trx
      .selectFrom('email_outbox')
      .select('id')
      .where((eb) =>
        eb.or([
          eb.and([eb('status', 'in', ['pending', 'retrying']), eb('next_attempt_at', '<=', now)]),
          eb.and([eb('status', '=', 'sending'), eb('locked_until', '<', now)]),
        ]),
      )
      .orderBy('next_attempt_at')
      .limit(limit)
      .forUpdate()
      .skipLocked()
      .execute();
    if (due.length === 0) return [];

    return trx
      .updateTable('email_outbox')
      .set({
        status: 'sending',
        attempts: sql<number>`attempts + 1`,
        locked_until: new Date(now.getTime() + leaseSeconds * 1000),
      })
      .where(
        'id',
        'in',
        due.map((row) => row.id),
      )
      .returningAll()
      .execute();
  });
}

/** Only this worker's claim (status still "sending") is finished. */
export function markSent(db: Kysely<Database>, id: string, now: Date) {
  return db
    .updateTable('email_outbox')
    .set({ status: 'sent', sent_at: now, locked_until: null, last_error: null })
    .where('id', '=', id)
    .where('status', '=', 'sending')
    .execute();
}

export function markAttemptFailed(
  db: Kysely<Database>,
  id: string,
  outcome: { status: 'retrying'; nextAttemptAt: Date } | { status: 'failed' },
  error: string,
) {
  return db
    .updateTable('email_outbox')
    .set({
      status: outcome.status,
      ...(outcome.status === 'retrying' ? { next_attempt_at: outcome.nextAttemptAt } : {}),
      locked_until: null,
      last_error: error,
    })
    .where('id', '=', id)
    .where('status', '=', 'sending')
    .execute();
}
