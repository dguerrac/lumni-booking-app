import { z } from 'zod';
import type { BookingDto } from './bookings';
import { BOOKING_STATUSES } from './constants';

/** An empty select sends "", which means "no filter". */
const blankToUndefined = (value: unknown) => (value === '' ? undefined : value);

/** Query string of GET /api/admin/bookings. Numbers arrive as text, hence coerce. */
export const adminBookingsQuerySchema = z
  .object({
    status: z.preprocess(blankToUndefined, z.enum(BOOKING_STATUSES).optional()),
    roomId: z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional()),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type AdminBookingsQuery = z.infer<typeof adminBookingsQuerySchema>;

/** What the admin sees of a booking: the booking plus who made it and why it was cancelled. */
export type AdminBookingDto = BookingDto & {
  customer: { id: number; name: string; email: string };
  roomName: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
};

export type AdminBookingPage = {
  items: AdminBookingDto[];
  total: number;
  page: number;
  pageSize: number;
};

/** The admin must say why a booking is cancelled; it's stored with the booking. */
export const adminCancelSchema = z
  .object({
    reason: z
      .string({ required_error: 'Escribe el motivo de la cancelación.' })
      .trim()
      .min(5, 'Escribe el motivo de la cancelación (mínimo 5 caracteres).')
      .max(500),
  })
  .strict();

export type AdminCancelRequest = z.infer<typeof adminCancelSchema>;
