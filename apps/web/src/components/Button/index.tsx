import type { ComponentProps } from 'react';
import { Spinner } from '../Spinner';
import styles from './styles.module.css';

type Props = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'quiet';
  /** Shows a small spinner and disables the button. The caller still changes the text. */
  loading?: boolean;
};

export function Button({
  variant = 'primary',
  loading = false,
  className,
  type = 'button',
  disabled,
  children,
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={[styles.button, styles[variant], className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
