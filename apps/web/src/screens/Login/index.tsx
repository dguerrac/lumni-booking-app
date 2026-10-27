import { type LoginRequest, loginRequestSchema } from '@lumni/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useLogin, useMe } from '../../api/auth';
import { BrandMark } from '../../components/BrandMark';
import { Button } from '../../components/Button';
import { PageLoader } from '../../components/PageLoader';
import { TextField } from '../../components/TextField';
import styles from './styles.module.css';

// Seeded accounts (see README). Shown only in development so evaluators can log in fast.
const TEST_ACCOUNTS = [
  { label: 'Ana Gómez, cliente', email: 'cliente.a@lumni.test', password: 'ClienteA123!' },
  { label: 'Bruno Díaz, cliente', email: 'cliente.b@lumni.test', password: 'ClienteB123!' },
  { label: 'Admin Lumni', email: 'admin@lumni.test', password: 'Admin123!' },
];

export function LoginScreen() {
  const { data: user, isPending: checkingSession } = useMe();
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginRequest>({ resolver: zodResolver(loginRequestSchema) });

  if (checkingSession) return <PageLoader />;
  if (user) return <Navigate to={from} replace />;

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, { onSuccess: () => navigate(from, { replace: true }) }),
  );

  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <BrandMark />

        <form className={styles.card} onSubmit={onSubmit} noValidate>
          <div className={styles.intro}>
            <h1 className={styles.title}>Inicia sesión</h1>
            <p className={styles.subtitle}>Cotiza y reserva salas de reunión por horas.</p>
          </div>

          <TextField
            label="Correo"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <TextField
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />

          {login.error && (
            <p role="alert" className={styles.formError}>
              {login.error.message}
            </p>
          )}

          <Button type="submit" loading={login.isPending}>
            {login.isPending ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </Button>
        </form>

        {import.meta.env.DEV && (
          <section className={styles.testAccounts} aria-labelledby="test-accounts">
            <h2 id="test-accounts" className={styles.testAccountsTitle}>
              Cuentas de prueba
            </h2>
            <div className={styles.testAccountsList}>
              {TEST_ACCOUNTS.map((account) => (
                <Button
                  key={account.email}
                  variant="quiet"
                  onClick={() => {
                    setValue('email', account.email);
                    setValue('password', account.password);
                  }}
                >
                  {account.label}
                </Button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
