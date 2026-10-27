import type { QuoteReason } from '@lumni/shared';

type DraftRulesInput = {
  partySize: number | null;
  roomCapacity: number;
  /** Number of coffees ordered (extras.coffee). */
  coffee?: number;
};

/**
 * Rules that relate the party to the room and the extras. Pure; checked on
 * every wizard step that changes one of them, and again at confirmation.
 * Room capacity is data (rooms.capacity), never guessed.
 */
export function checkDraftRules({
  partySize,
  roomCapacity,
  coffee = 0,
}: DraftRulesInput): QuoteReason[] {
  const violations: QuoteReason[] = [];

  if (partySize !== null && partySize > roomCapacity) {
    violations.push({
      code: 'PARTY_TOO_LARGE',
      message: `La sala elegida es para máximo ${roomCapacity} personas.`,
    });
  }

  if (coffee > 0 && partySize === null) {
    violations.push({
      code: 'PARTY_SIZE_REQUIRED',
      message: 'Indica cuántas personas asisten antes de pedir café.',
    });
  } else if (partySize !== null && coffee > partySize) {
    violations.push({
      code: 'COFFEE_EXCEEDS_PARTY',
      message: `Puedes pedir café para máximo ${partySize} personas.`,
    });
  }

  return violations;
}

type ConfirmableInput = {
  partySize: number | null;
  contact: { name: string | null; email: string | null; phone: string | null };
  extras: { coffee?: number };
  roomCapacity: number;
};

/**
 * Everything a draft needs before it can become a booking: the contact data
 * and party size from step 1, plus the party/room/coffee rules re-checked
 * against what is stored now.
 */
export function checkConfirmable({
  partySize,
  contact,
  extras,
  roomCapacity,
}: ConfirmableInput): QuoteReason[] {
  const violations: QuoteReason[] = [];

  if (!contact.name || !contact.email || !contact.phone) {
    violations.push({
      code: 'CONTACT_REQUIRED',
      message: 'Completa nombre, correo y teléfono (paso 1).',
    });
  }
  if (partySize === null) {
    violations.push({
      code: 'PARTY_SIZE_REQUIRED',
      message: 'Indica cuántas personas asisten (paso 1).',
    });
    return violations;
  }

  return [...violations, ...checkDraftRules({ partySize, roomCapacity, coffee: extras.coffee })];
}
