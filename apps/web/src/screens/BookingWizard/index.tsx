import type { WizardStep } from '@lumni/shared';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useBooking } from '../../api/bookings';
import { ApiError } from '../../api/client';
import { useRooms } from '../../api/quotes';
import { PageLoader } from '../../components/PageLoader';
import { endTimeOf, formatLongDate } from '../../lib/format';
import { Confirmed } from './Confirmed';
import { ContactStep } from './ContactStep';
import { DiscardDraft } from './DiscardDraft';
import { ExtrasStep } from './ExtrasStep';
import { SlotStep } from './SlotStep';
import { Stepper } from './Stepper';
import styles from './styles.module.css';

/**
 * The 3-step booking wizard. It opens at the step saved on the server
 * (booking.currentStep), so closing the browser or switching devices resumes
 * where the customer left off. Each "Siguiente" saves that step first.
 */
export function BookingWizardScreen() {
  const { id = '' } = useParams();
  const booking = useBooking(id);
  const { data: rooms } = useRooms();
  // null until the customer moves: then the saved step decides.
  const [chosenStep, setChosenStep] = useState<WizardStep | null>(null);

  if (booking.isPending) return <PageLoader />;

  if (!booking.data) {
    const notFound = booking.error instanceof ApiError && booking.error.status === 404;
    return (
      <div className={styles.notice}>
        <h1 className={styles.title}>
          {notFound ? 'No encontramos esta reserva' : 'No pudimos cargar la reserva'}
        </h1>
        {!notFound && <p className={styles.lead}>{booking.error?.message}</p>}
        <Link className={styles.link} to="/">
          Volver a cotizar
        </Link>
      </div>
    );
  }

  const data = booking.data;
  if (data.status === 'confirmed' || data.status === 'completed')
    return <Confirmed booking={data} />;
  if (data.status === 'cancelled') {
    return (
      <div className={styles.notice}>
        <h1 className={styles.title}>Esta reserva fue cancelada</h1>
        <Link className={styles.link} to="/">
          Volver a cotizar
        </Link>
      </div>
    );
  }

  const step = chosenStep ?? data.currentStep;
  const room = rooms?.find((r) => r.id === data.roomId);
  const summary =
    data.date && data.startTime && data.durationHours
      ? `${room?.name ?? 'Sala'}, ${formatLongDate(data.date)}, de ${data.startTime} a ${endTimeOf(data.startTime, data.durationHours)}.`
      : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.intro}>
          <h1 className={styles.title}>Tu reserva</h1>
          {summary && <p className={styles.lead}>{summary}</p>}
        </div>
        <DiscardDraft bookingId={data.id} />
      </header>

      <Stepper active={step} />

      {step === 1 && <ContactStep booking={data} onSaved={() => setChosenStep(2)} />}
      {step === 2 && (
        <SlotStep booking={data} onSaved={() => setChosenStep(3)} onBack={() => setChosenStep(1)} />
      )}
      {step === 3 && (
        <ExtrasStep
          booking={data}
          onBack={() => setChosenStep(2)}
          onChooseAnotherSlot={() => setChosenStep(2)}
        />
      )}
    </div>
  );
}
