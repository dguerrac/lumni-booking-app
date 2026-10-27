import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useDiscardDraft } from '../../../api/bookings';
import { Button } from '../../../components/Button';
import { ErrorList } from '../../../components/ErrorList';
import styles from './styles.module.css';

/** Discarding asks once, inline (no browser dialog), then goes back home. */
export function DiscardDraft({ bookingId }: { bookingId: string }) {
  const [asking, setAsking] = useState(false);
  const discard = useDiscardDraft(bookingId);
  const navigate = useNavigate();

  if (!asking) {
    return (
      <Button variant="quiet" onClick={() => setAsking(true)}>
        Descartar borrador
      </Button>
    );
  }

  return (
    <div className={styles.ask} role="group" aria-label="Descartar borrador">
      <p>¿Descartar este borrador? No se puede deshacer.</p>
      <div className={styles.buttons}>
        <Button
          variant="secondary"
          loading={discard.isPending}
          onClick={() => discard.mutate(undefined, { onSuccess: () => navigate('/') })}
        >
          Sí, descartar
        </Button>
        <Button variant="quiet" onClick={() => setAsking(false)} disabled={discard.isPending}>
          No, seguir
        </Button>
      </div>
      <ErrorList error={discard.error} />
    </div>
  );
}
