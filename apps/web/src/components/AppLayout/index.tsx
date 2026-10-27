import { NavLink, Outlet, useNavigate } from 'react-router';
import { useLogout, useMe } from '../../api/auth';
import { BrandMark } from '../BrandMark';
import { Button } from '../Button';
import styles from './styles.module.css';

export function AppLayout() {
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  const handleLogout = () =>
    logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) });

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brandAndNav}>
          <BrandMark />
          {user?.role === 'admin' && (
            <nav className={styles.nav} aria-label="Principal">
              <NavLink to="/" end className={styles.navLink}>
                Cotizar
              </NavLink>
              <NavLink to="/admin" className={styles.navLink}>
                Reservas
              </NavLink>
            </nav>
          )}
        </div>
        <div className={styles.account}>
          <span className={styles.userName}>{user?.name}</span>
          <Button variant="quiet" onClick={handleLogout} disabled={logout.isPending}>
            Cerrar sesión
          </Button>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
