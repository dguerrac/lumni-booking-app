import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  canTransition,
  InvalidTransitionError,
  sourcesFor,
} from './state-machine';

describe('canTransition', () => {
  // All 16 pairs, written out so the table is the specification.
  it.each([
    ['draft', 'draft', false],
    ['draft', 'confirmed', true],
    ['draft', 'completed', false],
    ['draft', 'cancelled', true],
    ['confirmed', 'draft', false],
    ['confirmed', 'confirmed', false],
    ['confirmed', 'completed', true],
    ['confirmed', 'cancelled', true],
    ['completed', 'draft', false],
    ['completed', 'confirmed', false],
    ['completed', 'completed', false],
    ['completed', 'cancelled', false],
    ['cancelled', 'draft', false],
    ['cancelled', 'confirmed', false],
    ['cancelled', 'completed', false],
    ['cancelled', 'cancelled', false],
  ] as const)('%s → %s: %s', (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed);
  });
});

describe('assertTransition', () => {
  it('passes for an allowed transition', () => {
    expect(() => assertTransition('draft', 'confirmed')).not.toThrow();
  });

  it('throws an InvalidTransitionError with a Spanish message for a forbidden one', () => {
    expect(() => assertTransition('cancelled', 'confirmed')).toThrow(InvalidTransitionError);
    expect(() => assertTransition('cancelled', 'confirmed')).toThrow(
      'Una reserva cancelada no puede pasar a confirmada.',
    );
  });
});

describe('sourcesFor', () => {
  it('lists the states a booking may come from, for the SQL WHERE clause', () => {
    expect(sourcesFor('cancelled')).toEqual(['draft', 'confirmed']);
    expect(sourcesFor('confirmed')).toEqual(['draft']);
    expect(sourcesFor('completed')).toEqual(['confirmed']);
    expect(sourcesFor('draft')).toEqual([]);
  });
});
