import { type ComponentProps, type ReactNode, useId } from 'react';
import styles from '../TextField/styles.module.css';

type Props = ComponentProps<'select'> & { label: string; error?: string; hint?: ReactNode };

/** Label + select + hint/error, wired for screen readers. Shares TextField's styles. */
export function SelectField({ label, error, hint, id, children, ...selectProps }: Props) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const messageId = `${selectId}-message`;
  const message = error ?? hint;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        {...selectProps}
      >
        {children}
      </select>
      {message && (
        <p id={messageId} className={error ? styles.error : styles.hint}>
          {message}
        </p>
      )}
    </div>
  );
}
