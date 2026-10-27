import type { QuoteResponse, RoomDto } from '@lumni/shared';
import { Button } from '../../../components/Button';
import { formatCop, formatHours, formatLongDate } from '../../../lib/format';
import { DayTimeline } from '../DayTimeline';
import styles from './styles.module.css';

type Props = {
  quote: QuoteResponse;
  room: RoomDto | undefined;
  onUseSuggestion: (startTime: string) => void;
  isRequoting: boolean;
};

/** Renders the API's quote as is: status, reasons, suggestion, timeline and price. */
export function QuoteResult({ quote, room, onUseSuggestion, isRequoting }: Props) {
  // The API returns ISO times with the Bogotá offset, so characters 11–16 are the local HH:mm.
  const endTime = quote.endsAt?.slice(11, 16) ?? quote.startTime;
  const { breakdown } = quote;

  return (
    <article className={styles.result}>
      <header className={styles.header}>
        <h2 className={quote.bookable ? styles.statusOk : styles.statusBlocked}>
          {quote.bookable ? 'Disponible' : 'No disponible'}
        </h2>
        <p className={styles.summary}>
          {room?.name}, {formatLongDate(quote.date)}, de {quote.startTime} a {endTime}.
        </p>
      </header>

      {quote.reasons.length > 0 && (
        <div className={styles.problems}>
          <ul className={styles.reasons}>
            {quote.reasons.map((reason) => (
              <li key={reason.code}>{reason.message}</li>
            ))}
          </ul>
          {quote.nextAvailable ? (
            <Button
              variant="secondary"
              onClick={() => onUseSuggestion(quote.nextAvailable!.startTime)}
              disabled={isRequoting}
            >
              Usar {quote.nextAvailable.startTime}–{quote.nextAvailable.endTime}
            </Button>
          ) : (
            <p className={styles.noSuggestion}>
              No hay otro horario libre ese día con esta duración.
            </p>
          )}
        </div>
      )}

      {quote.dayHours && (
        <DayTimeline
          dayHours={quote.dayHours}
          requested={{ startTime: quote.startTime, endTime }}
          bookable={quote.bookable}
          suggested={quote.nextAvailable}
        />
      )}

      <div className={styles.price}>
        <ul className={styles.breakdown} aria-label="Desglose del precio">
          <li>
            <span>
              {formatHours(quote.durationHours)}
              {room && ` × ${formatCop(room.hourlyRate)}`}
            </span>
            <span>{formatCop(breakdown.base)}</span>
          </li>
          {breakdown.discount > 0 && (
            <li>
              <span>Descuento por duración</span>
              <span>−{formatCop(breakdown.discount)}</span>
            </li>
          )}
          {breakdown.surcharge > 0 && (
            <li>
              <span>Recargo de sábado</span>
              <span>+{formatCop(breakdown.surcharge)}</span>
            </li>
          )}
          {breakdown.extrasTotal > 0 && (
            <li>
              <span>Extras</span>
              <span>+{formatCop(breakdown.extrasTotal)}</span>
            </li>
          )}
        </ul>
        <p className={styles.total}>
          <span className={styles.totalLabel}>Total</span>
          <span className={styles.totalAmount} data-testid="quote-total">
            {formatCop(breakdown.total)}
          </span>
        </p>
      </div>
    </article>
  );
}
