import { type AdminCancelRequest, adminCancelSchema } from '@lumni/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAdminCancel } from '../../../api/admin';
import { Button } from '../../../components/Button';
import { ErrorList } from '../../../components/ErrorList';
import { TextAreaField } from '../../../components/TextAreaField';
import styles from './styles.module.css';

/** Cancelling asks for a reason (the shared schema requires ≥ 5 characters, the API too). */
export function CancelBooking({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const cancel = useAdminCancel(bookingId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdminCancelRequest>({ resolver: zodResolver(adminCancelSchema) });

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Cancelar reserva
      </Button>
    );
  }

  const close = () => {
    reset();
    setOpen(false);
  };

  return (
    <form
      className={styles.form}
      aria-label="Cancelar reserva"
      onSubmit={handleSubmit((data) => cancel.mutate(data))}
      noValidate
    >
      <p className={styles.warning}>
        La reserva quedará cancelada y el horario volverá a estar libre. El motivo queda guardado.
      </p>
      <TextAreaField label="Motivo" error={errors.reason?.message} {...register('reason')} />
      <ErrorList error={cancel.error} />
      <div className={styles.buttons}>
        <Button type="submit" loading={cancel.isPending}>
          Confirmar cancelación
        </Button>
        <Button variant="quiet" onClick={close} disabled={cancel.isPending}>
          No cancelar
        </Button>
      </div>
    </form>
  );
}
