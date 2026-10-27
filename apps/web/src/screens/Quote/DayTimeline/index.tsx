import { minutesOf } from '../../../lib/format';
import styles from './styles.module.css';

type Slot = { startTime: string; endTime: string };

type Props = {
  dayHours: { opensAt: string; closesAt: string };
  requested: Slot;
  bookable: boolean;
  suggested: Slot | null;
};

/**
 * The opening day as a horizontal bar, with the requested slot (plum if
 * bookable, red if not) and the suggested slot outlined in green. All times
 * come from the API response; this only draws them.
 */
export function DayTimeline({ dayHours, requested, bookable, suggested }: Props) {
  const opens = minutesOf(dayHours.opensAt);
  const closes = minutesOf(dayHours.closesAt);
  const span = closes - opens;

  const position = (slot: Slot) => {
    const start = Math.max(minutesOf(slot.startTime), opens);
    const end = Math.min(minutesOf(slot.endTime), closes);
    return {
      left: `${((start - opens) / span) * 100}%`,
      width: `${((end - start) / span) * 100}%`,
    };
  };

  const hourMarks: number[] = [];
  for (let m = opens; m <= closes; m += 120) hourMarks.push(m);

  const description =
    `De ${requested.startTime} a ${requested.endTime}, dentro del horario de ` +
    `${dayHours.opensAt} a ${dayHours.closesAt}.` +
    (suggested ? ` Horario sugerido: de ${suggested.startTime} a ${suggested.endTime}.` : '');

  return (
    <figure className={styles.timeline}>
      <div className={styles.track} role="img" aria-label={description}>
        {hourMarks.map((m) => (
          <span
            key={m}
            className={styles.tick}
            style={{ left: `${((m - opens) / span) * 100}%` }}
          />
        ))}
        {suggested && <span className={styles.suggested} style={position(suggested)} />}
        <span
          className={bookable ? styles.requested : styles.requestedBlocked}
          style={position(requested)}
        />
      </div>
      <div className={styles.scale} aria-hidden="true">
        {hourMarks.map((m, i) => {
          // On narrow screens only every other label fits; always keep the first and the last.
          const last = hourMarks.length - 1;
          const major = i === last || (i % 2 === 0 && i !== last - 1);
          return (
            <span
              key={m}
              className={major ? undefined : styles.minorLabel}
              style={{ left: `${((m - opens) / span) * 100}%` }}
            >
              {Math.floor(m / 60)}:00
            </span>
          );
        })}
      </div>
      <figcaption className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={bookable ? styles.swatchRequested : styles.swatchBlocked} />
          Tu horario
        </span>
        {suggested && (
          <span className={styles.legendItem}>
            <span className={styles.swatchSuggested} />
            Horario sugerido
          </span>
        )}
      </figcaption>
    </figure>
  );
}
