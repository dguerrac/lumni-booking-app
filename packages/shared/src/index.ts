// Shared between the API, the React app and the AI tool layer.
// Schemas, types and business constants are added step by step.

export const ROOM_SIZES = ['small', 'medium', 'large'] as const;
export type RoomSize = (typeof ROOM_SIZES)[number];

export const BOOKING_STATUSES = ['draft', 'confirmed', 'completed', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const USER_ROLES = ['customer', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Extras chosen in wizard step 3. coffee = number of people who want coffee. */
export type BookingExtras = { projector?: boolean; coffee?: number };

export type { RoomDto } from './rooms';
export { extrasSchema, quoteRequestSchema, slotSchema } from './quotes';
export type {
  PriceBreakdown,
  QuoteReason,
  QuoteRequest,
  QuoteResponse,
  SlotRequest,
} from './quotes';
export { bookingStepSchema, contactStepSchema, createBookingSchema } from './bookings';
export type { BookingDto, BookingStepRequest, ContactStep, WizardStep } from './bookings';
export { loginRequestSchema } from './auth';
export type { LoginRequest, UserDto } from './auth';
