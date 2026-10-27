import { Link, Outlet } from 'react-router';
import { useMe } from '../../api/auth';
import styles from './styles.module.css';

/**
 * Admin screens only. The API enforces this too (requireRole('admin') → 403);
 * this only avoids showing a screen that would fail.
 */
export function RequireAdmin() {
  const { data: user } = useMe();
  if (user?.role === 'admin') return <Outlet />;

  return (
    <div className={styles.denied}>
      <h1 className={styles.title}>No tienes permiso</h1>
      <p className={styles.text}>Esta sección es solo para el equipo de Lumni.</p>
      <Link className={styles.link} to="/">
        Ir a cotizar
      </Link>
    </div>
  );
}
