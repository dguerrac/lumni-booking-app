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
