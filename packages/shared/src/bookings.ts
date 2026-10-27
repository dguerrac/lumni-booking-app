import type { BookingExtras, BookingStatus } from './index';
import type { PriceBreakdown } from './quotes';
import { z } from 'zod';
import { extrasSchema, slotSchema } from './quotes';

/** Creating a draft takes exactly a room and a slot, as quoted. */
export const createBookingSchema = slotSchema;

export type WizardStep = 1 | 2 | 3;

export type BookingDto = {
  id: string;
  status: BookingStatus;
  /** The wizard step to resume at. */
  currentStep: WizardStep;
  roomId: number | null;
  /** Bogotá calendar date and local start time; null while the draft has no slot. */
  date: string | null;
  startTime: string | null;
  durationHours: number | null;
  partySize: number | null;
  contact: {
    name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
  };
  extras: BookingExtras;
  /** Frozen at confirmation; null while draft. */
  price: PriceBreakdown | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Wizard step 1: who is booking and how many people attend. */
export const contactStepSchema = z
  .object({
    contactName: z.string().trim().min(2, 'Escribe el nombre de quien reserva.').max(100),
    contactEmail: z.string().trim().toLowerCase().email('Escribe un correo válido.'),
    contactPhone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ]{7,20}$/, 'Escribe un teléfono válido (solo números).'),
    company: z.string().trim().max(100).optional(),
    partySize: z
      .number({ invalid_type_error: 'Indica cuántas personas asisten.' })
      .int()
      .min(1, 'Debe asistir al menos una persona.')
      .max(50),
  })
  .strict();

export type ContactStep = z.infer<typeof contactStepSchema>;

/** PATCH /api/bookings/:id body: one wizard step at a time. */
export const bookingStepSchema = z.discriminatedUnion('step', [
  z.object({ step: z.literal(1), data: contactStepSchema }).strict(),
  z.object({ step: z.literal(2), data: slotSchema }).strict(),
  z.object({ step: z.literal(3), data: extrasSchema }).strict(),
]);

export type BookingStepRequest = z.infer<typeof bookingStepSchema>;
