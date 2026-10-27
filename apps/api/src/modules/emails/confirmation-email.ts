import type { BookingDto, BookingExtras, PriceBreakdown } from '@lumni/shared';
import { DateTime } from 'luxon';
import { PRICING } from '../quotes/domain/pricing-config';

export const BOOKING_CONFIRMED = 'booking_confirmed';

/** Everything the confirmation email shows, frozen when the booking is confirmed. */
export type ConfirmationPayload = {
  contactName: string;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  partySize: number;
  extras: BookingExtras;
  price: PriceBreakdown;
};

/**
 * Built from the confirmed booking, inside the confirm transaction. The email
 * shows exactly what was agreed, even if the booking changes later.
 */
export function buildConfirmationPayload(
  booking: BookingDto,
  roomName: string,
): ConfirmationPayload {
  const start = DateTime.fromISO(`${booking.date}T${booking.startTime}`, {
    zone: PRICING.timeZone,
  });
  return {
    contactName: booking.contact.name!,
    roomName,
    date: booking.date!,
    startTime: booking.startTime!,
    endTime: start.plus({ minutes: booking.durationHours! * 60 }).toFormat('HH:mm'),
    partySize: booking.partySize!,
    extras: booking.extras,
    price: booking.price!,
  };
}
