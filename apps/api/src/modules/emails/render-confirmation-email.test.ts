import { describe, expect, it } from 'vitest';
import type { ConfirmationPayload } from './confirmation-email';
import { renderConfirmationEmail } from './render-confirmation-email';

const payload: ConfirmationPayload = {
  contactName: 'Ana Gómez',
  roomName: 'Sala Orinoco',
  date: '2026-11-07',
  startTime: '08:00',
  endTime: '16:00',
  partySize: 6,
  extras: { projector: true, coffee: 6 },
  price: {
    base: 960_000,
    discount: 192_000,
    surcharge: 192_000,
    extrasTotal: 78_000,
    total: 1_038_000,
  },
};

const BOOKING_ID = '7f3c2a10-5b1e-4c8a-9d2f-0a1b2c3d4e5f';

describe('renderConfirmationEmail', () => {
  const email = renderConfirmationEmail({ bookingId: BOOKING_ID, to: 'ana@andes.studio', payload });

  it('is addressed to the contact, with the slot in the subject', () => {
    expect(email.to).toBe('ana@andes.studio');
    expect(email.subject).toBe(
      'Reserva confirmada: Sala Orinoco, sábado, 7 de noviembre, 08:00–16:00',
    );
  });

  it('has a stable Message-ID per booking, so a resend can be recognized as the same email', () => {
    expect(email.messageId).toBe(`<booking-confirmed.${BOOKING_ID}@lumni.local>`);
    expect(renderConfirmationEmail({ bookingId: BOOKING_ID, to: 'x@y.z', payload }).messageId).toBe(
      email.messageId,
    );
  });

  it('shows the agreed price line by line, in pesos', () => {
    for (const text of [email.text, email.html]) {
      expect(text).toContain('$960.000');
      expect(text).toContain('−$192.000');
      expect(text).toContain('+$192.000');
      expect(text).toContain('+$78.000');
      expect(text).toContain('$1.038.000');
    }
  });

  it('lists the extras and the party size', () => {
    expect(email.text).toContain('6 personas');
    expect(email.text).toContain('Proyector, café para 6');
  });

  it('escapes HTML in what the customer typed', () => {
    const tricky = renderConfirmationEmail({
      bookingId: BOOKING_ID,
      to: 'ana@andes.studio',
      payload: { ...payload, contactName: '<script>alert(1)</script>' },
    });

    expect(tricky.html).not.toContain('<script>');
    expect(tricky.html).toContain('&lt;script&gt;');
  });
});
