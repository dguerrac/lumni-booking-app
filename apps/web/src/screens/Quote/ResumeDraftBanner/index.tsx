import { Link } from 'react-router';
import { useCurrentDraft } from '../../../api/bookings';
import { useRooms } from '../../../api/quotes';
import { endTimeOf, formatLongDate } from '../../../lib/format';
import styles from './styles.module.css';

/** Offers to pick up the draft the customer left unfinished (here or on another device). */
export function ResumeDraftBanner() {
  const { data: draft } = useCurrentDraft();
  const { data: rooms } = useRooms();
  if (!draft) return null;

  const room = rooms?.find((r) => r.id === draft.roomId);
  const when =
    draft.date && draft.startTime && draft.durationHours
      ? `${formatLongDate(draft.date)}, de ${draft.startTime} a ${endTimeOf(draft.startTime, draft.durationHours)}`
      : null;

  return (
    <section className={styles.banner} aria-labelledby="resume-draft-title">
      <div className={styles.text}>
        <h2 id="resume-draft-title" className={styles.title}>
          Tienes una reserva sin terminar
        </h2>
        <p className={styles.detail}>{[room?.name, when].filter(Boolean).join(', ')}.</p>
      </div>
      <Link className={styles.action} to={`/reservas/${draft.id}`}>
        Continuar reserva
      </Link>
    </section>
  );
}
