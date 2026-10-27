import type { BookingEmailDto } from '@lumni/shared';
import styles from './styles.module.css';

export function emailStatusLabel(email: BookingEmailDto | null): string {
  if (!email) return 'Sin correo';
  switch (email.status) {
    case 'pending':
      return 'En cola';
    case 'sending':
      return 'Enviando';
    case 'retrying':
      return `Reintentando (${email.attempts} de ${email.maxAttempts} intentos)`;
    case 'sent':
      return 'Enviado';
    case 'failed':
      return 'Falló';
  }
}

/** The confirmation email's state, as a dot + words (never color alone). */
export function EmailStatusBadge({ email }: { email: BookingEmailDto | null }) {
  return (
    <span className={`${styles.badge} ${styles[email?.status ?? 'none']}`}>
      {emailStatusLabel(email)}
    </span>
  );
}
