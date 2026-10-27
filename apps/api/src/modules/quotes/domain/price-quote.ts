import type { BookingExtras, PriceBreakdown, RoomSize } from '@lumni/shared';
import { DateTime } from 'luxon';
import { PRICING } from './pricing-config';

export type PriceInput = {
  roomSize: RoomSize;
  /** Calendar date in Bogotá, 'YYYY-MM-DD'. Call validateSlot first. */
  date: string;
  durationHours: number;
  extras?: BookingExtras;
};

const SATURDAY = 6;

const percentOf = (amount: number, percent: number) => Math.round((amount * percent) / 100);

export function priceQuote({
  roomSize,
  date,
  durationHours,
  extras = {},
}: PriceInput): PriceBreakdown {
  const base = Math.round(PRICING.hourlyRates[roomSize] * durationHours);

  const tier = PRICING.discountTiers.find((t) => durationHours >= t.fromHours);
  const discount = percentOf(base, tier?.percent ?? 0);

  const isSaturday = DateTime.fromISO(date, { zone: PRICING.timeZone }).weekday === SATURDAY;
  const surcharge = isSaturday ? percentOf(base - discount, PRICING.saturdaySurchargePercent) : 0;

  const extrasTotal =
    (extras.projector ? PRICING.extras.projectorFlat : 0) +
    (extras.coffee ?? 0) * PRICING.extras.coffeePerPerson;

  return {
    base,
    discount,
    surcharge,
    extrasTotal,
    total: base - discount + surcharge + extrasTotal,
  };
}
