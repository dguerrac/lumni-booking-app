import type { BookingDto, BookingStepRequest, QuoteReason, SlotRequest } from '@lumni/shared';
import type { Kysely, Updateable } from 'kysely';
import type { DateTime } from 'luxon';
import type { BookingsTable, Database } from '../../db/types';
import { AppError, NotFoundError } from '../../http/errors';
import { findUserById } from '../auth/auth.repository';
import { toSlotBounds } from '../quotes/domain/slot-interval';
import { validateSlot } from '../quotes/domain/validate-slot';
import { findNextAvailableSlot } from '../quotes/domain/find-next-available-slot';
import { priceQuote } from '../quotes/domain/price-quote';
import { findRoomById } from '../rooms/rooms.repository';
import { toBookingDto } from './booking-dto';
import {
  findBlockingBookings,
  findCustomerBooking,
  markCancelled,
  markConfirmed,
  findLatestDraft,
  upsertDraft,
  updateDraft,
} from './bookings.repository';
import { checkConfirmable, checkDraftRules } from './domain/draft-rules';
import { assertTransition } from './domain/state-machine';

const bookingNotFound = () => new NotFoundError('BOOKING_NOT_FOUND', 'La reserva no existe.');

/**
 * Rules checked whenever a draft gets a slot: the room exists and the slot
 * follows the opening rules. Availability is NOT checked: drafts don't block
 * a slot; the no_overlap_confirmed constraint decides at confirmation.
 */
async function assertSlotAllowed(db: Kysely<Database>, slot: SlotRequest, now: DateTime) {
  const room = await findRoomById(db, slot.roomId);
  if (!room) throw new NotFoundError('ROOM_NOT_FOUND', 'La sala no existe.');

  const violations = validateSlot(slot, now);
  if (violations.length > 0) {
    throw new AppError(422, 'SLOT_NOT_VALID', 'Ese horario no se puede reservar.', violations);
  }
  return room;
}

/**
 * Wizard step 1 starts here: a draft with the quoted slot and the customer's
 * contact data. A customer has at most one draft; booking again moves it to
 * the new slot (see upsertDraft).
 */
export async function createDraft(
  db: Kysely<Database>,
  customerId: number,
  slot: SlotRequest,
  now: DateTime,
): Promise<BookingDto> {
  await assertSlotAllowed(db, slot, now);
  const customer = await findUserById(db, customerId);
  if (!customer) throw new AppError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');

  const { start, end } = toSlotBounds(slot);
  const row = await upsertDraft(db, {
    customer_id: customerId,
    room_id: slot.roomId,
    starts_at: start.toJSDate(),
    ends_at: end.toJSDate(),
    contact_name: customer.name,
    contact_email: customer.email,
    contact_phone: customer.phone,
    company: customer.company,
  });
  return toBookingDto(row);
}

export async function getCurrentDraft(db: Kysely<Database>, customerId: number) {
  const row = await findLatestDraft(db, customerId);
  if (!row) throw new NotFoundError('NO_DRAFT', 'No tienes reservas sin terminar.');
  return toBookingDto(row);
}

export async function getCustomerBooking(db: Kysely<Database>, id: string, customerId: number) {
  const row = await findCustomerBooking(db, id, customerId);
  if (!row) throw bookingNotFound();
  return toBookingDto(row);
}

const notEditable = () =>
  new AppError(409, 'BOOKING_NOT_EDITABLE', 'Solo se puede editar una reserva en borrador.');

function assertNoViolations(violations: QuoteReason[]) {
  if (violations.length > 0) {
    throw new AppError(422, 'DRAFT_NOT_VALID', 'Revisa los datos de la reserva.', violations);
  }
}

/**
 * Saves one wizard step. Each step re-checks the rules it can break, against
 * what is already stored: the party must fit the room, coffee ≤ party size,
 * and a new slot must follow the opening rules.
 */
export async function saveDraftStep(
  db: Kysely<Database>,
  id: string,
  customerId: number,
  input: BookingStepRequest,
  now: DateTime,
): Promise<BookingDto> {
  const booking = await findCustomerBooking(db, id, customerId);
  if (!booking) throw bookingNotFound();
  if (booking.status !== 'draft') throw notEditable();

  // Every draft gets its room on creation (POST /api/bookings requires one).
  const currentRoom = await findRoomById(db, booking.room_id!);
  if (!currentRoom) throw new NotFoundError('ROOM_NOT_FOUND', 'La sala no existe.');

  let changes: Updateable<BookingsTable>;

  switch (input.step) {
    case 1: {
      const { contactName, contactEmail, contactPhone, company, partySize } = input.data;
      assertNoViolations(
        checkDraftRules({
          partySize,
          roomCapacity: currentRoom.capacity,
          coffee: booking.extras.coffee,
        }),
      );
      changes = {
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        company: company || null,
        party_size: partySize,
      };
      break;
    }
    case 2: {
      const room = await assertSlotAllowed(db, input.data, now);
      assertNoViolations(
        checkDraftRules({
          partySize: booking.party_size,
          roomCapacity: room.capacity,
          coffee: booking.extras.coffee,
        }),
      );
      const { start, end } = toSlotBounds(input.data);
      changes = { room_id: room.id, starts_at: start.toJSDate(), ends_at: end.toJSDate() };
      break;
    }
    case 3: {
      assertNoViolations(
        checkDraftRules({
          partySize: booking.party_size,
          roomCapacity: currentRoom.capacity,
          coffee: input.data.coffee,
        }),
      );
      changes = { extras: input.data };
      break;
    }
  }

  const updated = await updateDraft(db, { id, customerId }, changes, Math.min(input.step + 1, 3));
  // Confirmed or cancelled between the read and the update.
  if (!updated) throw notEditable();
  return toBookingDto(updated);
}

const EXCLUSION_VIOLATION = '23P01';

/**
 * draft → confirmed. The two guarantees live in the database:
 * - Same draft confirmed twice (double click, retry, two tabs): the
 *   conditional UPDATE only matches a draft, so the second call updates
 *   nothing and gets the stored booking back, with the price agreed the
 *   first time. Nothing is recalculated.
 * - Two customers confirming the same room and time: the exclusion
 *   constraint lets one commit and rejects the other (23P01 → 409).
 *
 * The price is computed here, by the server's quoter, at the moment of
 * confirmation, and stored with the booking.
 */
export async function confirmBooking(
  db: Kysely<Database>,
  id: string,
  customerId: number,
  now: DateTime,
): Promise<BookingDto> {
  const row = await findCustomerBooking(db, id, customerId);
  if (!row) throw bookingNotFound();
  if (row.status === 'confirmed') return toBookingDto(row); // already done: idempotent
  assertTransition(row.status, 'confirmed');

  const booking = toBookingDto(row);
  const room = await findRoomById(db, row.room_id!);
  if (!room) throw new NotFoundError('ROOM_NOT_FOUND', 'La sala no existe.');
  const slot = {
    roomId: room.id,
    date: booking.date!,
    startTime: booking.startTime!,
    durationHours: booking.durationHours!,
  };

  // The draft may have been saved days ago: re-check everything now.
  assertNoViolations([
    ...validateSlot(slot, now),
    ...checkConfirmable({
      partySize: booking.partySize,
      contact: booking.contact,
      extras: booking.extras,
      roomCapacity: room.capacity,
    }),
  ]);

  const price = priceQuote({ ...slot, roomSize: room.size, extras: booking.extras });

  let confirmed;
  try {
    confirmed = await db.transaction().execute(async (trx) => {
      const updated = await markConfirmed(trx, { id, customerId }, price);
      // Part 2: the confirmation email is enqueued here, in the same transaction.
      return updated;
    });
  } catch (error) {
    if ((error as { code?: string }).code === EXCLUSION_VIOLATION) {
      throw await slotTaken(db, slot, now);
    }
    throw error;
  }

  if (confirmed) return toBookingDto(confirmed);

  // Nothing matched: a concurrent request changed the status first.
  const current = await findCustomerBooking(db, id, customerId);
  if (current?.status === 'confirmed') return toBookingDto(current); // the other confirm won
  assertTransition(current?.status ?? row.status, 'confirmed');
  throw notEditable();
}

/** 409 with the next free slot the same day, so the customer can pick another time. */
async function slotTaken(
  db: Kysely<Database>,
  slot: SlotRequest,
  now: DateTime,
): Promise<AppError> {
  const { start } = toSlotBounds(slot);
  const dayStart = start.startOf('day');
  const busy = await findBlockingBookings(db, {
    roomId: slot.roomId,
    from: dayStart.toJSDate(),
    to: dayStart.plus({ days: 1 }).toJSDate(),
  });
  return new AppError(409, 'SLOT_TAKEN', 'Otra persona acaba de confirmar ese horario.', {
    nextAvailable: findNextAvailableSlot(slot, busy, now),
  });
}

const CUSTOMER_CANCEL_REASON = 'Borrador descartado por el cliente';

/**
 * A customer may discard their own draft. Cancelling a confirmed booking is an
 * admin action (with a mandatory reason), so it's refused here.
 */
export async function cancelOwnDraft(
  db: Kysely<Database>,
  id: string,
  customerId: number,
): Promise<BookingDto> {
  const row = await findCustomerBooking(db, id, customerId);
  if (!row) throw bookingNotFound();
  if (row.status === 'cancelled') return toBookingDto(row); // already done: idempotent
  if (row.status !== 'draft') throw onlyDraftsCanBeDiscarded();
  assertTransition(row.status, 'cancelled');

  const cancelled = await markCancelled(db, { id, customerId }, CUSTOMER_CANCEL_REASON, ['draft']);
  if (cancelled) return toBookingDto(cancelled);

  // Nothing matched: a concurrent request changed the status first.
  const current = await findCustomerBooking(db, id, customerId);
  if (current?.status === 'cancelled') return toBookingDto(current);
  throw onlyDraftsCanBeDiscarded();
}

const onlyDraftsCanBeDiscarded = () =>
  new AppError(
    409,
    'BOOKING_NOT_EDITABLE',
    'Solo puedes descartar una reserva en borrador. Para cancelar una reserva confirmada, contacta a Lumni.',
  );
