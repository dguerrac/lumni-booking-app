// Every business number for quotes lives here. Changing a rule is one edit
// in this file plus one test.
//
// Weekdays use Luxon numbering: 1 = Monday … 7 = Sunday.
// Percentages are integers so money math never multiplies by a float rate.

export const PRICING = {
  timeZone: 'America/Bogota',

  hourlyRates: { small: 40_000, medium: 70_000, large: 120_000 },

  openingHours: {
    1: { opensAt: '07:00', closesAt: '21:00' },
    2: { opensAt: '07:00', closesAt: '21:00' },
    3: { opensAt: '07:00', closesAt: '21:00' },
    4: { opensAt: '07:00', closesAt: '21:00' },
    5: { opensAt: '07:00', closesAt: '21:00' },
    6: { opensAt: '07:00', closesAt: '21:00' },
    7: null, // Sunday: closed
  } as Record<number, { opensAt: string; closesAt: string } | null>,

  slotStepMinutes: 30,
  minDurationHours: 1,
  maxDurationHours: 10,

  /** Highest tier first; the first one that matches wins (tiers don't stack). */
  discountTiers: [
    { fromHours: 8, percent: 20 },
    { fromHours: 4, percent: 10 },
  ],

  /** Applied to (base − discount). */
  saturdaySurchargePercent: 25,

  extras: {
    projectorFlat: 30_000,
    coffeePerPerson: 8_000,
  },
} as const;
