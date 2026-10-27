import type { AdminBookingDto } from '@lumni/shared';
import { useRetryEmail } from '../../../api/admin';
import { Button } from '../../../components/Button';
import { EmailStatusBadge } from '../../../components/EmailStatusBadge';
import { ErrorList } from '../../../components/ErrorList';
import detailStyles from '../styles.module.css';
import styles from './styles.module.css';

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(iso));

/** The confirmation email as the outbox worker left it, with "Reintentar envío" when it failed. */
export function EmailSection({ booking }: { booking: AdminBookingDto }) {
  const retry = useRetryEmail(booking.id);
  const { email } = booking;

  return (
    <section className={detailStyles.panel} aria-label="Correo de confirmación">
      <h2 className={detailStyles.panelTitle}>Correo de confirmación</h2>
      {!email ? (
        <p className={styles.muted}>Se envía al confirmar la reserva.</p>
      ) : (
        <>
          <EmailStatusBadge email={email} />
          <dl className={detailStyles.facts}>
            <dt>Para</dt>
            <dd>{booking.contact.email}</dd>
            {email.sentAt ? (
              <>
                <dt>Enviado</dt>
                <dd>{formatDateTime(email.sentAt)}</dd>
              </>
            ) : (
              <>
                <dt>Intentos</dt>
                <dd>
                  {email.attempts} de {email.maxAttempts} intentos
                </dd>
              </>
            )}
            {email.lastError && email.status !== 'sent' && (
              <>
                <dt>Último error</dt>
                <dd className={styles.error}>{email.lastError}</dd>
              </>
            )}
          </dl>
          {email.status === 'failed' && (
            <div className={styles.retry}>
              <Button variant="secondary" loading={retry.isPending} onClick={() => retry.mutate()}>
                Reintentar envío
              </Button>
              <ErrorList error={retry.error} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
