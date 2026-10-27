import { DateTime } from 'luxon';
import type { ConfirmationPayload } from './confirmation-email';

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Same for every attempt of the same email; see renderConfirmationEmail. */
  messageId: string;
};

const pesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const cop = (amount: number) => `$${pesos.format(amount)}`;

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/**
 * Pure: payload in, email out (Spanish, text + HTML). The Message-ID is derived
 * from the booking, so every retry of this email carries the same one. A real
 * provider can use it (or an idempotency key) to drop a duplicate if a send
 * succeeded but the worker died before recording it.
 */
export function renderConfirmationEmail({
  bookingId,
  to,
  payload,
}: {
  bookingId: string;
  to: string;
  payload: ConfirmationPayload;
}): OutgoingEmail {
  const day = DateTime.fromISO(payload.date).setLocale('es-CO').toLocaleString({
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const when = `${day}, ${payload.startTime}–${payload.endTime}`;
  const extras =
    [
      payload.extras.projector && 'Proyector',
      payload.extras.coffee && `café para ${payload.extras.coffee}`,
    ]
      .filter(Boolean)
      .join(', ') || 'Sin extras';

  const { price } = payload;
  const priceLines: [string, string][] = [
    ['Sala', cop(price.base)],
    ...(price.discount > 0
      ? [['Descuento por duración', `−${cop(price.discount)}`] as [string, string]]
      : []),
    ...(price.surcharge > 0
      ? [['Recargo de sábado', `+${cop(price.surcharge)}`] as [string, string]]
      : []),
    ...(price.extrasTotal > 0
      ? [['Extras', `+${cop(price.extrasTotal)}`] as [string, string]]
      : []),
  ];
  const people = `${payload.partySize} ${payload.partySize === 1 ? 'persona' : 'personas'}`;

  const text = [
    `Hola, ${payload.contactName}:`,
    '',
    'Tu reserva en Lumni Coworking está confirmada.',
    '',
    `Sala: ${payload.roomName}`,
    `Fecha: ${when}`,
    `Personas: ${people}`,
    `Extras: ${extras}`,
    '',
    ...priceLines.map(([label, amount]) => `${label}: ${amount}`),
    `Total: ${cop(price.total)}`,
    '',
    'Te esperamos.',
  ].join('\n');

  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:4px 16px 4px 0;color:#616261">${escapeHtml(label)}</td>` +
    `<td style="padding:4px 0;text-align:right${strong ? ';font-weight:800;color:#9b2c51' : ''}">${escapeHtml(value)}</td></tr>`;

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#fff7fa;font-family:'Open Sans',Arial,sans-serif;color:#1c1c1c">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px">
<p style="margin:0 0 8px;color:#9b2c51;font-weight:800">Lumni Coworking</p>
<h1 style="margin:0 0 16px;font-size:24px">Tu reserva está confirmada</h1>
<p>Hola, ${escapeHtml(payload.contactName)}:</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
${row('Sala', payload.roomName)}
${row('Fecha', when)}
${row('Personas', people)}
${row('Extras', extras)}
</table>
<table style="width:100%;border-collapse:collapse;margin:16px 0;border-top:1px solid #e5e9ef">
${priceLines.map(([label, amount]) => row(label, amount)).join('\n')}
${row('Total', cop(price.total), true)}
</table>
<p style="margin:0;color:#616261">Te esperamos.</p>
</div></body></html>`;

  return {
    to,
    subject: `Reserva confirmada: ${payload.roomName}, ${when}`,
    text,
    html,
    messageId: `<booking-confirmed.${bookingId}@lumni.local>`,
  };
}
