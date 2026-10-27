import { Spinner } from '../Spinner';
import styles from './styles.module.css';

/** Full-screen loading state while the app checks who is logged in. */
export function PageLoader() {
  return (
    <div className={styles.page}>
      <Spinner label="Cargando…" />
    </div>
  );
}
