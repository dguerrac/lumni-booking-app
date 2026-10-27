import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '../../api/auth';

/** Renders the child routes only with a session; otherwise sends the visitor to /login. */
export function RequireAuth() {
  const { data: user, isPending } = useMe();
  const location = useLocation();

  if (isPending) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
