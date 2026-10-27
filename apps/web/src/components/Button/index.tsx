import type { ComponentProps } from 'react';
import styles from './styles.module.css';

type Props = ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'quiet' };

export function Button({ variant = 'primary', className, type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={[styles.button, styles[variant], className].filter(Boolean).join(' ')}
      {...props}
    />
  );
}
