import { type BookingDto, type SlotRequest, slotSchema } from '@lumni/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useSaveStep } from '../../../api/bookings';
import { useRooms } from '../../../api/quotes';
import { Button } from '../../../components/Button';
import { ErrorList } from '../../../components/ErrorList';
import { SelectField } from '../../../components/SelectField';
import { Spinner } from '../../../components/Spinner';
import { TextField } from '../../../components/TextField';
import { formatCop, formatHours } from '../../../lib/format';
import { DURATIONS, START_TIMES } from '../../../lib/slot-options';
import styles from '../styles.module.css';

type Props = { booking: BookingDto; onSaved: () => void; onBack: () => void };

/** Step 2: room and time, prefilled from the quote. The API re-checks the rules on save. */
export function SlotStep(props: Props) {
  const rooms = useRooms();
  // The room select can only show the saved room once its option exists.
  if (rooms.isPending) {
    return (
      <div className={styles.panel}>
        <Spinner label="Cargando salas…" />
      </div>
    );
  }
  return <SlotForm {...props} rooms={rooms.data ?? []} />;
}

function SlotForm({
  booking,
  onSaved,
  onBack,
  rooms,
}: Props & { rooms: NonNullable<ReturnType<typeof useRooms>['data']> }) {
  const save = useSaveStep(booking.id);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SlotRequest>({
    resolver: zodResolver(slotSchema),
    defaultValues: {
      roomId: booking.roomId ?? undefined,
      date: booking.date ?? '',
      startTime: booking.startTime ?? '09:00',
      durationHours: booking.durationHours ?? 2,
    },
  });

  const selectedRoom = rooms.find((room) => room.id === watch('roomId'));
  const onSubmit = handleSubmit((data) => save.mutate({ step: 2, data }, { onSuccess: onSaved }));

  return (
    <form className={styles.panel} onSubmit={onSubmit} noValidate>
      <h2 className={styles.stepTitle}>Sala y horario</h2>

      <div className={styles.fields}>
        <div className={styles.full}>
          <SelectField
            label="Sala"
            error={errors.roomId?.message}
            hint={
              selectedRoom &&
              `${formatCop(selectedRoom.hourlyRate)} por hora, hasta ${selectedRoom.capacity} personas`
            }
            {...register('roomId', { valueAsNumber: true })}
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} (hasta {room.capacity} personas)
              </option>
            ))}
          </SelectField>
        </div>
        <div className={styles.full}>
          <TextField label="Fecha" type="date" error={errors.date?.message} {...register('date')} />
        </div>
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

      <ErrorList error={save.error} />

      <div className={styles.actions}>
        <Button variant="secondary" onClick={onBack}>
          Atrás
        </Button>
        <Button type="submit" loading={save.isPending}>
          Siguiente
        </Button>
      </div>
    </form>
  );
}
