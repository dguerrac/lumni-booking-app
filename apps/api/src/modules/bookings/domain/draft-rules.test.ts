import { describe, expect, it } from 'vitest';
import { checkConfirmable, checkDraftRules } from './draft-rules';

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

describe('checkConfirmable', () => {
  const complete = {
    partySize: 3,
    contact: { name: 'Ana Gómez', email: 'ana@andes.studio', phone: '3001234567' },
    extras: { coffee: 3 },
    roomCapacity: 4,
  };

  it('accepts a complete draft', () => {
    expect(checkConfirmable(complete)).toEqual([]);
  });

  it('asks for the party size (wizard step 1)', () => {
    expect(checkConfirmable({ ...complete, partySize: null, extras: {} })).toEqual([
      { code: 'PARTY_SIZE_REQUIRED', message: 'Indica cuántas personas asisten (paso 1).' },
    ]);
  });

  it('asks for the missing contact data', () => {
    const codes = checkConfirmable({
      ...complete,
      contact: { name: 'Ana Gómez', email: null, phone: '' },
    }).map((v) => v.code);

    expect(codes).toEqual(['CONTACT_REQUIRED']);
  });

  it('re-checks capacity and coffee', () => {
    const codes = checkConfirmable({ ...complete, roomCapacity: 2 }).map((v) => v.code);

    expect(codes).toEqual(['PARTY_TOO_LARGE']);
  });
});
