import { z } from 'zod';
import { NotFoundError } from './errors';

/** A malformed id can't match any booking: answer 404, same as an unknown or foreign id. */
export function parseBookingId(raw: string): string {
  const parsed = z.string().uuid().safeParse(raw);
  if (!parsed.success) throw new NotFoundError('BOOKING_NOT_FOUND', 'La reserva no existe.');
  return parsed.data;
}
