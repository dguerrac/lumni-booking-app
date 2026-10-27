import { describe, expect, it } from 'vitest';
import { failFirst } from './email-sender';
import type { EmailSender } from './email-sender';
import type { OutgoingEmail } from './render-confirmation-email';

const email: OutgoingEmail = {
  to: 'ana@andes.studio',
  subject: 'Reserva confirmada',
  text: 'Hola',
  html: '<p>Hola</p>',
  messageId: '<booking-confirmed.1@lumni.local>',
};

function recordingSender() {
  const sent: OutgoingEmail[] = [];
  const sender: EmailSender = { send: async (message) => void sent.push(message) };
  return { sender, sent };
}

describe('failFirst (EMAIL_FAIL_FIRST_N, to demo retries)', () => {
  it('fails the first N sends, then lets every send through', async () => {
    const { sender, sent } = recordingSender();
    const flaky = failFirst(2, sender);

    await expect(flaky.send(email)).rejects.toThrow('Fallo simulado de SMTP (1 de 2)');
    await expect(flaky.send(email)).rejects.toThrow('Fallo simulado de SMTP (2 de 2)');
    await flaky.send(email);
    await flaky.send(email);

    expect(sent).toHaveLength(2);
  });

  it('with 0 it is the sender itself', () => {
    const { sender } = recordingSender();

    expect(failFirst(0, sender)).toBe(sender);
  });
});
