import { describe, expect, it } from 'vitest';
import { checkDraftRules } from './draft-rules';

const codes = (input: Parameters<typeof checkDraftRules>[0]) =>
  checkDraftRules(input).map((v) => v.code);

describe('checkDraftRules', () => {
  it.each([
    ['a party that fits', { partySize: 4, roomCapacity: 4 }],
    ['no party size yet', { partySize: null, roomCapacity: 4 }],
    ['coffee for everyone', { partySize: 6, roomCapacity: 8, coffee: 6 }],
    ['no coffee', { partySize: 6, roomCapacity: 8, coffee: 0 }],
  ])('accepts %s', (_case, input) => {
    expect(codes(input)).toEqual([]);
  });

  it('rejects a party larger than the room', () => {
    expect(checkDraftRules({ partySize: 6, roomCapacity: 4 })).toEqual([
      { code: 'PARTY_TOO_LARGE', message: 'La sala elegida es para máximo 4 personas.' },
    ]);
  });

  it('rejects more coffees than people', () => {
    expect(codes({ partySize: 3, roomCapacity: 8, coffee: 5 })).toEqual(['COFFEE_EXCEEDS_PARTY']);
  });

  it('asks for the party size before coffee can be ordered', () => {
    expect(codes({ partySize: null, roomCapacity: 8, coffee: 2 })).toEqual(['PARTY_SIZE_REQUIRED']);
  });
});
