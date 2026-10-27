import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';
import type { ConfirmationPayload } from './confirmation-email';
import { afterFailure } from './domain/retry-policy';
import type { EmailSender } from './email-sender';
import { claimDueEmails, markAttemptFailed, markSent } from './outbox.repository';
import { renderConfirmationEmail } from './render-confirmation-email';

const BATCH_SIZE = 10;
/** A claimed email is "being sent" for at most this long; then another worker may retry it. */
const LEASE_SECONDS = 60;

type Options = {
  db: Kysely<Database>;
  sender: EmailSender;
  now: Date;
  random?: () => number;
};

/**
 * One pass of the worker: claim the due emails, then send each one outside
 * any transaction and record the outcome.
 *
 * Delivery is at-least-once: if the SMTP send succeeds and the process dies
 * before markSent, the lease expires and the email is sent again. The stable
 * Message-ID lets a real provider drop that duplicate.
 */
export async function processDueEmails({ db, sender, now, random }: Options) {
  const claimed = await claimDueEmails(db, now, BATCH_SIZE, LEASE_SECONDS);
  const summary = { sent: 0, retrying: 0, failed: 0 };

  for (const email of claimed) {
    try {
      await sender.send(
        renderConfirmationEmail({
          bookingId: email.booking_id,
          to: email.to_email,
          payload: email.payload as ConfirmationPayload,
        }),
      );
      await markSent(db, email.id, now);
      summary.sent += 1;
    } catch (error) {
      const outcome = afterFailure({ attempts: email.attempts, now, random });
      await markAttemptFailed(db, email.id, outcome, errorMessage(error));
      summary[outcome.status] += 1;
    }
  }

  return summary;
}

const errorMessage = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 500);
