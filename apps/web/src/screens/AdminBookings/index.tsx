import { type AdminBookingsQuery, adminBookingsQuerySchema, BOOKING_STATUSES } from '@lumni/shared';
import { Link, useSearchParams } from 'react-router';
import { useAdminBookings } from '../../api/admin';
import { useRooms } from '../../api/quotes';
import { Button } from '../../components/Button';
import { EmailStatusBadge } from '../../components/EmailStatusBadge';
import { ErrorList } from '../../components/ErrorList';
import { SelectField } from '../../components/SelectField';
import { Spinner } from '../../components/Spinner';
import { StatusBadge } from '../../components/StatusBadge';
import { endTimeOf, formatCop, formatLongDate } from '../../lib/format';
import { STATUS_LABELS } from '../../lib/status';
import styles from './styles.module.css';

/**
 * Filters and page live in the URL (?status=&roomId=&page=), so a filtered
 * view survives a reload and can be shared as a link.
 */
function useListQuery(): [AdminBookingsQuery, (changes: Record<string, string | null>) => void] {
  const [params, setParams] = useSearchParams();
  const parsed = adminBookingsQuerySchema.safeParse(Object.fromEntries(params));
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 20 };

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  };
  return [query, update];
}

export function AdminBookingsScreen() {
  const [query, update] = useListQuery();
  const bookings = useAdminBookings(query);
  const { data: rooms } = useRooms();

  const totalPages = bookings.data
    ? Math.max(1, Math.ceil(bookings.data.total / query.pageSize))
    : 1;
  // A new filter shows its first page.
  const setFilter = (key: 'status' | 'roomId', value: string) =>
    update({ [key]: value, page: null });
  const goToPage = (page: number) => update({ page: page === 1 ? null : String(page) });

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Reservas</h1>
        <p className={styles.lead}>
          Todas las reservas de los clientes, de la más reciente a la más antigua.
        </p>
      </header>

      <div className={styles.filters}>
        <SelectField
          label="Estado"
          value={query.status ?? ''}
          onChange={(e) => setFilter('status', e.target.value)}
        >
          <option value="">Todos</option>
          {BOOKING_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Sala"
          value={query.roomId ? String(query.roomId) : ''}
          onChange={(e) => setFilter('roomId', e.target.value)}
        >
          <option value="">Todas</option>
          {rooms?.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </SelectField>
      </div>

      <section className={styles.panel} aria-busy={bookings.isFetching}>
        {bookings.isPending ? (
          <Spinner label="Cargando reservas…" />
        ) : bookings.error ? (
          <ErrorList error={bookings.error} />
        ) : bookings.data.items.length === 0 ? (
          <p className={styles.empty}>No hay reservas con estos filtros.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table} aria-label="Reservas">
              <thead>
                <tr>
                  <th scope="col">Fecha y hora</th>
                  <th scope="col">Sala</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Correo</th>
                  <th scope="col" className={styles.amount}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {bookings.data.items.map((booking) => (
                  <tr key={booking.id}>
                    <td>
                      <Link className={styles.rowLink} to={`/admin/reservas/${booking.id}`}>
                        {booking.date && booking.startTime && booking.durationHours
                          ? `${formatLongDate(booking.date)}, ${booking.startTime}–${endTimeOf(booking.startTime, booking.durationHours)}`
                          : 'Sin horario'}
                      </Link>
                    </td>
                    <td>{booking.roomName ?? '—'}</td>
                    <td>
                      <span className={styles.customer}>{booking.customer.name}</span>
                      <span className={styles.email}>{booking.customer.email}</span>
                    </td>
                    <td>
                      <StatusBadge status={booking.status} />
                    </td>
                    <td>
                      <EmailStatusBadge email={booking.email} />
                    </td>
                    <td className={styles.amount}>
                      {booking.price ? formatCop(booking.price.total) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <nav className={styles.pagination} aria-label="Páginas">
        <Button
          variant="secondary"
          disabled={query.page <= 1}
          onClick={() => goToPage(query.page - 1)}
        >
          Anterior
        </Button>
        <span>
          Página {query.page} de {totalPages}
        </span>
        <Button
          variant="secondary"
          disabled={query.page >= totalPages}
          onClick={() => goToPage(query.page + 1)}
        >
          Siguiente
        </Button>
      </nav>
    </div>
  );
}
