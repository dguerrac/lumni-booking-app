import { type QuoteRequest, quoteRequestSchema } from '@lumni/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useQuote, useRooms } from '../../api/quotes';
import { Button } from '../../components/Button';
import { SelectField } from '../../components/SelectField';
import { Spinner } from '../../components/Spinner';
import { TextField } from '../../components/TextField';
import { formatCop, formatHours } from '../../lib/format';
import { QuoteResult } from './QuoteResult';
import styles from './styles.module.css';

// Choices offered by the form. The API re-checks every rule (opening hours,
// past times, 30-minute blocks); these lists only keep the form short.
const START_TIMES = Array.from({ length: 28 }, (_, i) => {
  const minutes = 7 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${minutes % 60 === 0 ? '00' : '30'}`;
});
const DURATIONS = Array.from({ length: 19 }, (_, i) => 1 + i * 0.5);

export function QuoteScreen() {
  const rooms = useRooms();
  const quote = useQuote();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<QuoteRequest>({
    resolver: zodResolver(quoteRequestSchema),
    defaultValues: { startTime: '09:00', durationHours: 2 },
  });

  const submitQuote = handleSubmit((values) => quote.mutate(values));
  const selectedRoom = rooms.data?.find((room) => room.id === watch('roomId'));
  const quotedRoom = rooms.data?.find((room) => room.id === quote.data?.roomId);

  const useSuggestion = (startTime: string) => {
    setValue('startTime', startTime);
    void submitQuote();
  };

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Cotiza tu sala</h1>
        <p className={styles.lead}>Mira el precio y si la sala está libre antes de reservar.</p>
      </header>

      <div className={styles.layout}>
        <form className={styles.form} onSubmit={submitQuote} noValidate>
          <SelectField
            label="Sala"
            error={errors.roomId?.message}
            hint={selectedRoom && `${formatCop(selectedRoom.hourlyRate)} por hora`}
            defaultValue=""
            disabled={rooms.isPending}
            {...register('roomId', { valueAsNumber: true })}
          >
            <option value="" disabled>
              {rooms.isPending ? 'Cargando salas…' : 'Elige una sala'}
            </option>
            {rooms.data?.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} (hasta {room.capacity} personas)
              </option>
            ))}
          </SelectField>

          <TextField label="Fecha" type="date" error={errors.date?.message} {...register('date')} />

          <div className={styles.row}>
            <SelectField
              label="Hora de inicio"
              error={errors.startTime?.message}
              {...register('startTime')}
            >
              {START_TIMES.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Duración"
              error={errors.durationHours?.message}
              {...register('durationHours', { valueAsNumber: true })}
            >
              {DURATIONS.map((hours) => (
                <option key={hours} value={hours}>
                  {formatHours(hours)}
                </option>
              ))}
            </SelectField>
          </div>

          <Button type="submit" loading={quote.isPending}>
            {quote.isPending ? 'Cotizando…' : 'Cotizar'}
          </Button>

          {quote.error && (
            <p role="alert" className={styles.formError}>
              {quote.error.message}
            </p>
          )}
        </form>

        <section
          className={styles.resultPanel}
          aria-live="polite"
          aria-busy={quote.isPending}
          aria-label="Resultado"
        >
          {quote.isPending ? (
            <div className={styles.loading}>
              <Spinner label="Calculando precio y disponibilidad…" />
            </div>
          ) : quote.data ? (
            <QuoteResult
              quote={quote.data}
              room={quotedRoom}
              onUseSuggestion={useSuggestion}
              isRequoting={quote.isPending}
            />
          ) : (
            <p className={styles.empty}>
              Elige sala, fecha y hora. Aquí verás el precio, los descuentos y si el horario está
              libre.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
