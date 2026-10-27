import { type ComponentProps, useId } from 'react';
import styles from './styles.module.css';

type Props = ComponentProps<'input'> & { label: string; error?: string };

/** Label + input + error message, wired for screen readers. Accepts react-hook-form's register(). */
export function TextField({ label, error, id, ...inputProps }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
