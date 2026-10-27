import { type ComponentProps, useId } from 'react';
import styles from '../TextField/styles.module.css';

type Props = ComponentProps<'textarea'> & { label: string; error?: string };

/** Multi-line TextField: same label, error and styles. */
export function TextAreaField({ label, error, id, ...textareaProps }: Props) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = `${textareaId}-error`;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={textareaId}>
        {label}
      </label>
      <textarea
        id={textareaId}
        className={`${styles.input} ${styles.textarea}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        rows={3}
        {...textareaProps}
      />
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
