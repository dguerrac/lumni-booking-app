import type { BookingDto, BookingStepRequest, QuoteReason, SlotRequest } from '@lumni/shared';
import type { Kysely, Updateable } from 'kysely';
import type { DateTime } from 'luxon';
import type { BookingsTable, Database } from '../../db/types';
import { AppError, NotFoundError } from '../../http/errors';
import { findUserById } from '../auth/auth.repository';
import { toSlotBounds } from '../quotes/domain/slot-interval';
import { validateSlot } from '../quotes/domain/validate-slot';
import { findRoomById } from '../rooms/rooms.repository';
import { toBookingDto } from './booking-dto';
import {
  findCustomerBooking,
  findLatestDraft,
  insertDraft,
  updateDraft,
} from './bookings.repository';
import { checkDraftRules } from './domain/draft-rules';

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

/** Wizard step 1 starts here: a draft with the quoted slot and the customer's contact data. */
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
  const row = await insertDraft(db, {
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
