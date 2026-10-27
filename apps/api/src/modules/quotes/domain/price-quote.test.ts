import { describe, expect, it } from 'vitest';
import { priceQuote } from './price-quote';

// Tue 3 Nov 2026 is a weekday; Sat 7 Nov 2026 is a Saturday.
const TUESDAY = '2026-11-03';
const SATURDAY = '2026-11-07';

describe('priceQuote', () => {
  it.each([
    // case, size, date, hours, base, discount, surcharge, total
    ['small, 1 h on a weekday', 'small', TUESDAY, 1, 40_000, 0, 0, 40_000],
    ['medium, 3.5 h: just under the first tier', 'medium', TUESDAY, 3.5, 245_000, 0, 0, 245_000],
    ['medium, exactly 4 h: 10 % tier', 'medium', TUESDAY, 4, 280_000, 28_000, 0, 252_000],
    ['small, 7.5 h: still 10 %', 'small', TUESDAY, 7.5, 300_000, 30_000, 0, 270_000],
    ['medium, exactly 8 h: 20 % tier', 'medium', TUESDAY, 8, 560_000, 112_000, 0, 448_000],
    ['small, 2 h on Saturday: surcharge only', 'small', SATURDAY, 2, 80_000, 0, 20_000, 100_000],
    [
      'medium, 4 h on Saturday: surcharge on the discounted value',
      'medium',
      SATURDAY,
      4,
      280_000,
      28_000,
      63_000,
      315_000,
    ],
    [
      'large, 8 h on Saturday: 20 % off, then 25 % on top',
      'large',
      SATURDAY,
      8,
      960_000,
      192_000,
      192_000,
      960_000,
    ],
  ] as const)('%s', (_case, roomSize, date, durationHours, base, discount, surcharge, total) => {
    expect(priceQuote({ roomSize, date, durationHours })).toEqual({
      base,
      discount,
      surcharge,
      extrasTotal: 0,
      total,
    });
  });

  it('adds the projector flat fee and coffee per person after discounts', () => {
    expect(
      priceQuote({
        roomSize: 'small',
        date: TUESDAY,
        durationHours: 2,
        extras: { projector: true, coffee: 3 },
      }),
    ).toEqual({ base: 80_000, discount: 0, surcharge: 0, extrasTotal: 54_000, total: 134_000 });
  });

  it('does not discount or surcharge the extras', () => {
    expect(
      priceQuote({
        roomSize: 'large',
        date: SATURDAY,
        durationHours: 8,
        extras: { projector: true },
      }),
    ).toEqual({
      base: 960_000,
      discount: 192_000,
      surcharge: 192_000,
      extrasTotal: 30_000,
      total: 990_000,
    });
  });

  it('returns whole pesos in every field', () => {
    const quote = priceQuote({
      roomSize: 'medium',
      date: SATURDAY,
      durationHours: 5.5,
      extras: { coffee: 7 },
    });

    expect(Object.values(quote).every(Number.isInteger)).toBe(true);
  });
});
