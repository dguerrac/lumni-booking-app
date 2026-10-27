import type { BookingDto } from '@lumni/shared';
import { useForm } from 'react-hook-form';
import { useSaveStep } from '../../../api/bookings';
import { useLiveQuote, useRooms } from '../../../api/quotes';
import { Button } from '../../../components/Button';
import { ErrorList } from '../../../components/ErrorList';
import { Spinner } from '../../../components/Spinner';
import { TextField } from '../../../components/TextField';
import { formatCop } from '../../../lib/format';
import { QuoteResult } from '../../Quote/QuoteResult';
import styles from '../styles.module.css';
import extrasStyles from './styles.module.css';

type Props = { booking: BookingDto; onBack: () => void };
type ExtrasValues = { projector: boolean; coffee: number };

/**
 * Step 3: extras and a live summary. The price comes from POST /api/quotes
 * with the extras, the same quoter the API uses at confirmation.
 */
export function ExtrasStep({ booking, onBack }: Props) {
  const save = useSaveStep(booking.id);
  const { data: rooms } = useRooms();
  const { register, handleSubmit, watch } = useForm<ExtrasValues>({
    defaultValues: {
      projector: booking.extras.projector ?? false,
      coffee: booking.extras.coffee ?? 0,
    },
  });

  const projector = watch('projector');
  const coffeeInput = watch('coffee');
  const extras = { projector, coffee: Number.isFinite(coffeeInput) ? coffeeInput : 0 };

  const quote = useLiveQuote(
    booking.roomId && booking.date && booking.startTime && booking.durationHours
      ? {
          roomId: booking.roomId,
          date: booking.date,
          startTime: booking.startTime,
          durationHours: booking.durationHours,
          extras,
        }
      : null,
  );

  // Confirmation (status → confirmed) is wired in Step 8; for now this saves the extras.
  const onSubmit = handleSubmit(() => save.mutate({ step: 3, data: extras }));

  return (
    <form className={styles.panel} onSubmit={onSubmit} noValidate>
      <h2 className={styles.stepTitle}>Extras y confirmación</h2>

      <fieldset className={extrasStyles.extras}>
        <legend className={extrasStyles.legend}>Extras</legend>
        <div className={extrasStyles.checkbox}>
          <label className={extrasStyles.checkboxLabel}>
            <input type="checkbox" aria-describedby="projector-price" {...register('projector')} />
            Proyector
          </label>
          <span id="projector-price" className={extrasStyles.price}>
            {formatCop(30_000)} por reserva
          </span>
        </div>
        <TextField
          label="Cafés"
          type="number"
          inputMode="numeric"
          min={0}
          max={booking.partySize ?? undefined}
          {...register('coffee', { valueAsNumber: true })}
        />
        <p className={extrasStyles.hint}>
          {formatCop(8_000)} por persona
          {booking.partySize ? `, hasta ${booking.partySize} (las personas que asisten).` : '.'}
        </p>
      </fieldset>

      <section
        className={extrasStyles.summary}
        aria-label="Resumen de la reserva"
        aria-busy={quote.isFetching}
      >
        {quote.data ? (
          <QuoteResult quote={quote.data} room={rooms?.find((r) => r.id === booking.roomId)} />
        ) : (
          <Spinner label="Calculando precio…" />
        )}
      </section>

      <ErrorList error={save.error} />

      <div className={styles.actions}>
        <Button variant="secondary" onClick={onBack}>
          Atrás
        </Button>
        <Button type="submit" loading={save.isPending}>
          Confirmar reserva
        </Button>
      </div>
    </form>
  );
}
