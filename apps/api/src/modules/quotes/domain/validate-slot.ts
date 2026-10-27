import { DateTime } from 'luxon';
import { PRICING } from './pricing-config';
import { toSlotBounds } from './slot-interval';

export type SlotInput = {
  /** Calendar date in Bogotá, 'YYYY-MM-DD'. */
  date: string;
  /** Local start time in Bogotá, 'HH:mm'. */
  startTime: string;
  durationHours: number;
};

export type SlotViolationCode =
  | 'INVALID_DATE'
  | 'INVALID_TIME'
  | 'INVALID_DURATION'
  | 'CLOSED_DAY'
  | 'NOT_ON_SLOT_BOUNDARY'
  | 'BEFORE_OPENING'
  | 'AFTER_CLOSING'
  | 'IN_PAST';

export type SlotViolation = { code: SlotViolationCode; message: string };

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Returns every business rule the slot breaks; an empty list means the slot is valid.
 * Pure: "now" is passed in. The date and time are read in Bogotá, never in the
 * server's zone, so Saturday 19:00 stays Saturday even though it is Sunday in UTC.
 */
export function validateSlot(input: SlotInput, now: DateTime): SlotViolation[] {
  const { timeZone, openingHours, slotStepMinutes, minDurationHours, maxDurationHours } = PRICING;

  const day = DateTime.fromISO(input.date, { zone: timeZone });
  if (!day.isValid) return [{ code: 'INVALID_DATE', message: 'La fecha no es válida.' }];
  if (!TIME_PATTERN.test(input.startTime)) {
    return [{ code: 'INVALID_TIME', message: 'La hora no es válida.' }];
  }

  const violations: SlotViolation[] = [];
  const { start, end } = toSlotBounds(input);
  const durationMinutes = input.durationHours * 60;

  const durationInRange =
    input.durationHours >= minDurationHours && input.durationHours <= maxDurationHours;
  if (!durationInRange || !Number.isInteger(durationMinutes / slotStepMinutes)) {
    violations.push({
      code: 'INVALID_DURATION',
      message: `La duración debe estar entre ${minDurationHours} y ${maxDurationHours} horas, en bloques de ${slotStepMinutes} minutos.`,
    });
  }

  if (start.minute % slotStepMinutes !== 0) {
    violations.push({
      code: 'NOT_ON_SLOT_BOUNDARY',
      message: 'La hora de inicio debe ser en punto o y media (por ejemplo 9:00 o 9:30).',
    });
  }

  const hours = openingHours[start.weekday];
  if (!hours) {
    violations.push({ code: 'CLOSED_DAY', message: 'El coworking no abre ese día.' });
  } else {
    const opensAt = DateTime.fromISO(`${input.date}T${hours.opensAt}`, { zone: timeZone });
    const closesAt = DateTime.fromISO(`${input.date}T${hours.closesAt}`, { zone: timeZone });

    if (start < opensAt) {
      violations.push({
        code: 'BEFORE_OPENING',
        message: `La sala abre a las ${hours.opensAt}.`,
      });
    }
    if (end > closesAt) {
      violations.push({
        code: 'AFTER_CLOSING',
        message: `La reserva debe terminar a más tardar a las ${hours.closesAt}.`,
      });
    }
  }

  if (start <= now) {
    violations.push({ code: 'IN_PAST', message: 'Ese horario ya pasó.' });
  }

  return violations;
}
