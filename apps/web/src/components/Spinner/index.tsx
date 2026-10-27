import styles from './styles.module.css';

type Props = {
  /** With a label it announces itself to screen readers (role="status"); without one it's decorative. */
  label?: string;
  size?: 'sm' | 'md';
};

export function Spinner({ label, size = 'md' }: Props) {
  const ring = <span className={`${styles.ring} ${styles[size]}`} aria-hidden="true" />;
  if (!label) return ring;

  return (
    <span role="status" className={styles.status}>
      {ring}
      <span>{label}</span>
    </span>
  );
}
