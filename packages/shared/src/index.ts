// Shared between the API, the React app and the AI tool layer.
// Schemas, types and business constants are added step by step.

export { BOOKING_STATUSES, ROOM_SIZES, USER_ROLES } from './constants';
export type { BookingStatus, RoomSize, UserRole } from './constants';

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
export { adminBookingsQuerySchema, adminCancelSchema } from './admin';
export type {
  AdminBookingDto,
  AdminBookingPage,
  AdminBookingsQuery,
  AdminCancelRequest,
} from './admin';
