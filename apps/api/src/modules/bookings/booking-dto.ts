import type { BookingDto, WizardStep } from '@lumni/shared';
import { DateTime } from 'luxon';
import { PRICING } from '../quotes/domain/pricing-config';
import type { BookingRow } from './bookings.repository';

/** Database row → API shape. Times are shown in Bogotá, whatever the server's zone. */
export function toBookingDto(row: BookingRow): BookingDto {
  const start = row.starts_at && DateTime.fromJSDate(row.starts_at, { zone: PRICING.timeZone });
  const end = row.ends_at && DateTime.fromJSDate(row.ends_at, { zone: PRICING.timeZone });

  return {
    id: row.id,
    status: row.status,
    currentStep: row.current_step as WizardStep,
    roomId: row.room_id,
    date: start ? start.toISODate() : null,
    startTime: start ? start.toFormat('HH:mm') : null,
    durationHours: start && end ? end.diff(start, 'hours').hours : null,
    partySize: row.party_size,
    contact: {
      name: row.contact_name,
      email: row.contact_email,
      phone: row.contact_phone,
      company: row.company,
    },
    extras: row.extras,
    price:
      row.total === null
        ? null
        : {
            base: row.base ?? 0,
            discount: row.discount ?? 0,
            surcharge: row.surcharge ?? 0,
            extrasTotal: row.extras_total ?? 0,
            total: row.total,
          },
    confirmedAt: row.confirmed_at ? row.confirmed_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
