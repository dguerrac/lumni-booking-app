import { z } from 'zod';

/**
 * Shape of a quote request. Only the format is checked here (400 if wrong);
 * business rules (opening hours, duration 1–10 h, past dates) are checked by
 * the quoter and come back as reasons in a 200 response.
 */
/**
 * A room and a time slot. Only the format is checked here (400 if wrong);
 * business rules (opening hours, duration 1–10 h, past dates) are checked by
 * the API and come back as reasons.
 */
export const slotSchema = z
  .object({
    roomId: z.number({ invalid_type_error: 'Elige una sala.' }).int().positive(),
    date: z
      .string()
      .min(1, 'Elige una fecha.')
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD.'),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Usa el formato HH:mm.'),
    durationHours: z.number({ invalid_type_error: 'Elige la duración.' }).positive().max(24),
  })
  .strict();

export type SlotRequest = z.infer<typeof slotSchema>;

export const extrasSchema = z
  .object({
    projector: z.boolean().optional(),
    coffee: z.number().int().min(0).max(50).optional(),
  })
  .strict();

export const quoteRequestSchema = slotSchema.extend({ extras: extrasSchema.optional() }).strict();

export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

/** Integer COP. */
export type PriceBreakdown = {
  base: number;
  discount: number;
  surcharge: number;
  extrasTotal: number;
  total: number;
};

export type QuoteReason = { code: string; message: string };

export type QuoteResponse = {
  roomId: number;
  date: string;
  startTime: string;
  durationHours: number;
  /** ISO 8601 with the Bogotá offset; null when the date or time is not valid. */
  startsAt: string | null;
  endsAt: string | null;
  /** Opening hours of that day, for the timeline; null when closed or the date is not valid. */
  dayHours: { opensAt: string; closesAt: string } | null;
  breakdown: PriceBreakdown;
  bookable: boolean;
  reasons: QuoteReason[];
  /** Next free slot the same day, only when not bookable. */
  nextAvailable: { startTime: string; endTime: string } | null;
};
