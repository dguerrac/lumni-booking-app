import type { BookingDto } from '@lumni/shared';
import { Link } from 'react-router';
import { useRooms } from '../../../api/quotes';
import { endTimeOf, formatCop, formatLongDate } from '../../../lib/format';
import styles from './styles.module.css';

/** A confirmed booking: the agreed price as the server froze it, never recalculated here. */
export function Confirmed({ booking }: { booking: BookingDto }) {
  const { data: rooms } = useRooms();
  const room = rooms?.find((r) => r.id === booking.roomId);
  const price = booking.price;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.mark} aria-hidden="true" />
        <h1 className={styles.title}>Reserva confirmada</h1>
        {booking.date && booking.startTime && booking.durationHours && (
          <p className={styles.lead}>
            {room?.name ?? 'Sala'}, {formatLongDate(booking.date)}, de {booking.startTime} a{' '}
            {endTimeOf(booking.startTime, booking.durationHours)}.
          </p>
        )}
        {booking.contact.email && (
          <p className={styles.note}>
            Te enviaremos la confirmación a <strong>{booking.contact.email}</strong>.
          </p>
        )}
      </header>

      {price && (
        <section className={styles.receipt} aria-label="Precio acordado">
          <ul className={styles.lines}>
            <li>
              <span>Sala</span>
              <span>{formatCop(price.base)}</span>
            </li>
            {price.discount > 0 && (
              <li>
                <span>Descuento por duración</span>
                <span>−{formatCop(price.discount)}</span>
              </li>
            )}
            {price.surcharge > 0 && (
              <li>
                <span>Recargo de sábado</span>
                <span>+{formatCop(price.surcharge)}</span>
              </li>
            )}
            {price.extrasTotal > 0 && (
              <li>
                <span>Extras</span>
                <span>+{formatCop(price.extrasTotal)}</span>
              </li>
            )}
          </ul>
          <p className={styles.total}>
            <span>Total</span>
            <span className={styles.amount} data-testid="confirmed-total">
              {formatCop(price.total)}
            </span>
          </p>
        </section>
      )}

      <Link className={styles.action} to="/">
        Hacer otra reserva
      </Link>
    </div>
  );
}
