import type { AdminBookingDto, AdminBookingPage, AdminBookingsQuery } from '@lumni/shared';
import type { Kysely } from 'kysely';
import type { DateTime } from 'luxon';
import type { Database } from '../../db/types';
import { AppError, NotFoundError } from '../../http/errors';
import { toBookingDto } from '../bookings/booking-dto';
import { assertTransition } from '../bookings/domain/state-machine';
import { MAX_ATTEMPTS } from '../emails/domain/retry-policy';
import {
  adminMarkCancelled,
  adminMarkCompleted,
  type AdminBookingRow,
  findAdminBooking,
  listAdminBookings,
  requeueFailedEmail,
} from './admin.repository';

export function toAdminBookingDto(row: AdminBookingRow): AdminBookingDto {
  return {
    ...toBookingDto(row),
    customer: { id: row.customer_id, name: row.customer_name, email: row.customer_email },
    roomName: row.room_name,
    cancelReason: row.cancel_reason,
    cancelledAt: row.cancelled_at ? row.cancelled_at.toISOString() : null,
    email: row.email_status
      ? {
          status: row.email_status,
          attempts: row.email_attempts!,
          maxAttempts: MAX_ATTEMPTS,
          lastError: row.email_last_error,
          sentAt: row.email_sent_at ? row.email_sent_at.toISOString() : null,
          nextAttemptAt: row.email_next_attempt_at!.toISOString(),
        }
      : null,
  };
}

export async function listBookingsForAdmin(
  db: Kysely<Database>,
  query: AdminBookingsQuery,
): Promise<AdminBookingPage> {
  const { rows, total } = await listAdminBookings(db, query);
  return { items: rows.map(toAdminBookingDto), total, page: query.page, pageSize: query.pageSize };
}

async function loadBooking(db: Kysely<Database>, id: string) {
  const row = await findAdminBooking(db, id);
  if (!row) throw new NotFoundError('BOOKING_NOT_FOUND', 'La reserva no existe.');
  return row;
}

export async function getBookingForAdmin(db: Kysely<Database>, id: string) {
  return toAdminBookingDto(await loadBooking(db, id));
}

/** draft | confirmed → cancelled, with the admin's reason. Frees the slot. */
export async function cancelBookingAsAdmin(db: Kysely<Database>, id: string, reason: string) {
  const row = await loadBooking(db, id);
  assertTransition(row.status, 'cancelled');

  if (!(await adminMarkCancelled(db, id, reason))) {
    // Changed by someone else in between: report the state it is in now.
    assertTransition((await loadBooking(db, id)).status, 'cancelled');
  }
  return getBookingForAdmin(db, id);
}

/** confirmed → completed, only once the booking has ended. */
export async function completeBooking(db: Kysely<Database>, id: string, now: DateTime) {
  const row = await loadBooking(db, id);
  assertTransition(row.status, 'completed');
  if (row.ends_at && row.ends_at > now.toJSDate()) throw notFinished();

  if (!(await adminMarkCompleted(db, id, now.toJSDate()))) {
    assertTransition((await loadBooking(db, id)).status, 'completed');
    throw notFinished();
  }
  return getBookingForAdmin(db, id);
}

const notFinished = () =>
  new AppError(409, 'BOOKING_NOT_FINISHED', 'Solo se puede completar una reserva que ya terminó.');

/** The admin sends a failed confirmation email again ("Reintentar"). The worker picks it up. */
export async function retryFailedEmail(db: Kysely<Database>, bookingId: string) {
  const row = await loadBooking(db, bookingId);
  if (!row.email_status) {
    throw new NotFoundError('EMAIL_NOT_FOUND', 'Esta reserva no tiene correo de confirmación.');
  }
  if (!(await requeueFailedEmail(db, bookingId))) {
    throw new AppError(409, 'EMAIL_NOT_FAILED', 'Solo se puede reintentar un correo que falló.');
  }
  return getBookingForAdmin(db, bookingId);
}
