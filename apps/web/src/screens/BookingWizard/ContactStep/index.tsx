import {
  type BookingDto,
  type ContactStep as ContactValues,
  contactStepSchema,
} from '@lumni/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useSaveStep } from '../../../api/bookings';
import { Button } from '../../../components/Button';
import { ErrorList } from '../../../components/ErrorList';
import { TextField } from '../../../components/TextField';
import styles from '../styles.module.css';

type Props = { booking: BookingDto; onSaved: () => void };

/** Step 1: who books and how many people attend. Prefilled from the logged-in user. */
export function ContactStep({ booking, onSaved }: Props) {
  const save = useSaveStep(booking.id);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactStepSchema),
    defaultValues: {
      contactName: booking.contact.name ?? '',
      contactEmail: booking.contact.email ?? '',
      contactPhone: booking.contact.phone ?? '',
      company: booking.contact.company ?? '',
      partySize: booking.partySize ?? undefined,
    },
  });

  const onSubmit = handleSubmit((data) => save.mutate({ step: 1, data }, { onSuccess: onSaved }));

  return (
    <form className={styles.panel} onSubmit={onSubmit} noValidate>
      <h2 className={styles.stepTitle}>Tus datos</h2>

      <div className={styles.fields}>
        <div className={styles.full}>
          <TextField
            label="Nombre"
            autoComplete="name"
            error={errors.contactName?.message}
            {...register('contactName')}
          />
        </div>
        <TextField
          label="Correo"
          type="email"
          autoComplete="email"
          error={errors.contactEmail?.message}
          {...register('contactEmail')}
        />
        <TextField
          label="Teléfono"
          type="tel"
          autoComplete="tel"
          error={errors.contactPhone?.message}
          {...register('contactPhone')}
        />
        <TextField
          label="Empresa (opcional)"
          autoComplete="organization"
          error={errors.company?.message}
          {...register('company')}
        />
        <TextField
          label="Personas que asisten"
          type="number"
          inputMode="numeric"
          min={1}
          error={errors.partySize?.message}
          {...register('partySize', { valueAsNumber: true })}
        />
      </div>

      <ErrorList error={save.error} />

      <div className={styles.actions}>
        <Button type="submit" loading={save.isPending}>
          Siguiente
        </Button>
      </div>
    </form>
  );
}
