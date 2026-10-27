import type { BookingStatus } from '@lumni/shared';
import { STATUS_LABELS } from '../../lib/status';
import styles from './styles.module.css';

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`${styles.badge} ${styles[status]}`}>{STATUS_LABELS[status]}</span>;
}
