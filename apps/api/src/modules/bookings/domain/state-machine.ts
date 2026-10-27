import { BOOKING_STATUSES, type BookingStatus } from '@lumni/shared';

/**
 * Allowed transitions. Anything not listed is forbidden; completed and
 * cancelled are final.
 *
 *   draft ──► confirmed ──► completed
 *     │           │
 *     └──► cancelled ◄┘
 */
const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const LABELS: Record<BookingStatus, string> = {
  draft: 'en borrador',
  confirmed: 'confirmada',
  completed: 'completada',
  cancelled: 'cancelada',
};

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: BookingStatus,
    readonly to: BookingStatus,
  ) {
    super(`Una reserva ${LABELS[from]} no puede pasar a ${LABELS[to]}.`);
  }
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/**
 * The states a booking may move to `to` from. Services put this list in the
 * UPDATE's WHERE clause, so the database applies the rule atomically, not a
 * check in code that could race.
 */
export function sourcesFor(to: BookingStatus): BookingStatus[] {
  return BOOKING_STATUSES.filter((from) => canTransition(from, to));
}
