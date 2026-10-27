import type { WizardStep } from '@lumni/shared';
import styles from './styles.module.css';

export const STEP_TITLES: Record<WizardStep, string> = {
  1: 'Tus datos',
  2: 'Sala y horario',
  3: 'Extras y confirmación',
};

/** The three steps in order; the active one is marked with aria-current="step". */
export function Stepper({ active }: { active: WizardStep }) {
  return (
    <ol className={styles.stepper} aria-label="Pasos de la reserva">
      {([1, 2, 3] as const).map((step) => (
        <li
          key={step}
          className={step < active ? styles.done : step === active ? styles.active : styles.todo}
          aria-current={step === active ? 'step' : undefined}
        >
          <span className={styles.number} aria-hidden="true">
            {step}
          </span>
          <span>{STEP_TITLES[step]}</span>
        </li>
      ))}
    </ol>
  );
}
