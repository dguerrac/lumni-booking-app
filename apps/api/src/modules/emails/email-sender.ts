import nodemailer from 'nodemailer';
import type { OutgoingEmail } from './render-confirmation-email';

/** The worker only knows this interface; tests pass a fake, production passes SMTP. */
export interface EmailSender {
  send(email: OutgoingEmail): Promise<void>;
}

/**
 * Plain SMTP via Nodemailer. Locally it points to Mailpit (port 1025), which
 * catches every email and shows it at http://localhost:8025. In production
 * only the host, port and credentials change.
 */
export function smtpSender({
  host,
  port,
  from,
}: {
  host: string;
  port: number;
  from: string;
}): EmailSender {
  const transport = nodemailer.createTransport({ host, port, secure: false });
  return {
    async send(email) {
      await transport.sendMail({
        from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html,
        messageId: email.messageId,
      });
    },
  };
}

/**
 * Demo only (EMAIL_FAIL_FIRST_N): the first `n` sends fail, then every send
 * goes through. EMAIL_FAIL_FIRST_N=2 shows retries ending in "sent";
 * EMAIL_FAIL_FIRST_N=10 shows an email ending in "failed".
 */
export function failFirst(n: number, sender: EmailSender): EmailSender {
  if (n <= 0) return sender;
  let failures = 0;
  return {
    async send(email) {
      if (failures < n) {
        failures += 1;
        throw new Error(`Fallo simulado de SMTP (${failures} de ${n})`);
      }
      await sender.send(email);
    },
  };
}
