import type { AdminBookingDto, BookingExtras } from '@lumni/shared';
import { Link, useParams } from 'react-router';
import { useAdminBooking, useAdminComplete } from '../../api/admin';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { ErrorList } from '../../components/ErrorList';
import { PageLoader } from '../../components/PageLoader';
import { StatusBadge } from '../../components/StatusBadge';
import { endTimeOf, formatCop, formatLongDate } from '../../lib/format';
import { CancelBooking } from './CancelBooking';
import { EmailSection } from './EmailSection';
import styles from './styles.module.css';

const describeExtras = ({ projector, coffee }: BookingExtras) =>
  [projector && 'Proyector', coffee && `café para ${coffee}`].filter(Boolean).join(', ') ||
  'Sin extras';

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(iso));

export function AdminBookingDetailScreen() {
  const { id = '' } = useParams();
  const booking = useAdminBooking(id);

  if (booking.isPending) return <PageLoader />;
  if (!booking.data) {
    const notFound = booking.error instanceof ApiError && booking.error.status === 404;
    return (
      <div className={styles.notice}>
        <h1 className={styles.title}>
          {notFound ? 'No encontramos esta reserva' : 'No pudimos cargar la reserva'}
        </h1>
        <Link className={styles.back} to="/admin">
          Volver a la lista
        </Link>
      </div>
    );
  }

  return <Detail booking={booking.data} />;
}

function Detail({ booking }: { booking: AdminBookingDto }) {
  const complete = useAdminComplete(booking.id);
  const when =
    booking.date && booking.startTime && booking.durationHours
      ? `${formatLongDate(booking.date)}, ${booking.startTime}–${endTimeOf(booking.startTime, booking.durationHours)}`
      : 'Sin horario';
  const canCancel = booking.status === 'draft' || booking.status === 'confirmed';
  const canComplete = booking.status === 'confirmed';

  return (
    <div className={styles.page}>
      <Link className={styles.back} to="/admin">
        Volver a la lista
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>{when}</h1>
        <StatusBadge status={booking.status} />
      </header>

      {booking.status === 'cancelled' && (
        <section className={styles.cancelled} aria-label="Cancelación">
          <p className={styles.label}>
            Cancelada{booking.cancelledAt && ` el ${formatDateTime(booking.cancelledAt)}`}. Motivo:
          </p>
          <p className={styles.reason}>{booking.cancelReason}</p>
        </section>
      )}

      <div className={styles.grid}>
        <section className={styles.panel} aria-label="Reserva">
          <h2 className={styles.panelTitle}>Reserva</h2>
          <dl className={styles.facts}>
            <dt>Sala</dt>
            <dd>{booking.roomName ?? '—'}</dd>
            <dt>Personas</dt>
            <dd>
              {booking.partySize
                ? `${booking.partySize} ${booking.partySize === 1 ? 'persona' : 'personas'}`
                : '—'}
            </dd>
            <dt>Extras</dt>
            <dd>{describeExtras(booking.extras)}</dd>
            <dt>Creación</dt>
            <dd>{formatDateTime(booking.createdAt)}</dd>
            {booking.confirmedAt && (
              <>
                <dt>Confirmación</dt>
                <dd>{formatDateTime(booking.confirmedAt)}</dd>
              </>
            )}
          </dl>
        </section>

        <section className={styles.panel} aria-label="Cliente">
          <h2 className={styles.panelTitle}>Cliente</h2>
          <dl className={styles.facts}>
            <dt>Cuenta</dt>
            <dd>
              {booking.customer.name}
              <span className={styles.muted}>{booking.customer.email}</span>
            </dd>
            <dt>Contacto</dt>
            <dd>
              {booking.contact.name ?? '—'}
              {booking.contact.email && (
                <span className={styles.muted}>{booking.contact.email}</span>
              )}
              {booking.contact.phone && (
                <span className={styles.muted}>{booking.contact.phone}</span>
              )}
            </dd>
            {booking.contact.company && (
              <>
                <dt>Empresa</dt>
                <dd>{booking.contact.company}</dd>
              </>
            )}
          </dl>
        </section>

        <EmailSection booking={booking} />

        {booking.price && (
          <section className={styles.panel} aria-label="Precio acordado">
            <h2 className={styles.panelTitle}>Precio acordado</h2>
            <dl className={styles.facts}>
              <dt>Sala</dt>
              <dd className={styles.amount}>{formatCop(booking.price.base)}</dd>
              {booking.price.discount > 0 && (
                <>
                  <dt>Descuento</dt>
                  <dd className={styles.amount}>−{formatCop(booking.price.discount)}</dd>
                </>
              )}
              {booking.price.surcharge > 0 && (
                <>
                  <dt>Recargo de sábado</dt>
                  <dd className={styles.amount}>+{formatCop(booking.price.surcharge)}</dd>
                </>
              )}
              {booking.price.extrasTotal > 0 && (
                <>
                  <dt>Extras</dt>
                  <dd className={styles.amount}>+{formatCop(booking.price.extrasTotal)}</dd>
                </>
              )}
              <dt className={styles.totalLabel}>Total</dt>
              <dd className={`${styles.amount} ${styles.total}`}>
                {formatCop(booking.price.total)}
              </dd>
            </dl>
          </section>
        )}
      </div>

      {(canCancel || canComplete) && (
        <section className={styles.actions} aria-label="Acciones">
          {canComplete && (
            <Button loading={complete.isPending} onClick={() => complete.mutate(undefined)}>
              Marcar como completada
            </Button>
          )}
          {canCancel && <CancelBooking bookingId={booking.id} />}
          <ErrorList error={complete.error} />
        </section>
      )}
    </div>
  );
}
