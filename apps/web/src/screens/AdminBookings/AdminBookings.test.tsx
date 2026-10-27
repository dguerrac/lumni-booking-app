import type { AdminBookingDto } from '@lumni/shared';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { adminBookingDto, adminUser, anaGomez, mockRooms, mockSession } from '../../test/fixtures';
import { renderApp } from '../../test/render-app';
import { server } from '../../test/server';

const bookings: AdminBookingDto[] = [
  adminBookingDto({ id: '00000000-0000-4000-8000-000000000001' }),
  adminBookingDto({
    id: '00000000-0000-4000-8000-000000000002',
    status: 'cancelled',
    roomId: 5,
    roomName: 'Sala Orinoco',
    customer: { id: 2, name: 'Bruno Díaz', email: 'cliente.b@lumni.test' },
    cancelReason: 'Mantenimiento',
    price: { base: 240_000, discount: 0, surcharge: 0, extrasTotal: 0, total: 240_000 },
  }),
];

/** The admin list API: records each query string and answers with the given page. */
function mockAdminList(items = bookings, { total = items.length, pageSize = 20 } = {}) {
  const queries: string[] = [];
  server.use(
    http.get('*/api/admin/bookings', ({ request }) => {
      const url = new URL(request.url);
      queries.push(url.search);
      return HttpResponse.json({
        items,
        total,
        page: Number(url.searchParams.get('page') ?? 1),
        pageSize,
      });
    }),
  );
  return queries;
}

beforeEach(() => {
  mockRooms();
});

describe('Admin bookings list', () => {
  it("shows every customer's bookings with room, customer, status and total", async () => {
    mockSession({ loggedInAs: adminUser });
    mockAdminList();
    renderApp('/admin');

    const table = await screen.findByRole('table', { name: 'Reservas' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Sala Andes');
    expect(rows[0]).toHaveTextContent('Ana Gómez');
    expect(rows[0]).toHaveTextContent('Confirmada');
    expect(rows[0]).toHaveTextContent('$80.000');
    expect(rows[1]).toHaveTextContent('Bruno Díaz');
    expect(rows[1]).toHaveTextContent('Cancelada');
    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument();
  });

  it('filters by status and room, and keeps the filters in the URL', async () => {
    mockSession({ loggedInAs: adminUser });
    const queries = mockAdminList();
    const { user, currentUrl } = renderApp('/admin');

    await screen.findByRole('table', { name: 'Reservas' });
    await user.selectOptions(screen.getByLabelText('Estado'), 'Confirmada');
    await screen.findByRole('option', { name: 'Sala Orinoco' });
    await user.selectOptions(screen.getByLabelText('Sala'), 'Sala Orinoco');

    expect(currentUrl()).toBe('/admin?status=confirmed&roomId=5');
    expect(queries.at(-1)).toBe('?status=confirmed&roomId=5&page=1&pageSize=20');
  });

  it('opens with the filters and page from the URL (a shared or reloaded link)', async () => {
    mockSession({ loggedInAs: adminUser });
    const queries = mockAdminList(bookings, { total: 45 });
    renderApp('/admin?status=cancelled&page=2');

    await screen.findByRole('table', { name: 'Reservas' });
    expect(screen.getByLabelText('Estado')).toHaveDisplayValue('Cancelada');
    expect(queries[0]).toBe('?status=cancelled&page=2&pageSize=20');
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
  });

  it('moves between pages', async () => {
    mockSession({ loggedInAs: adminUser });
    const queries = mockAdminList(bookings, { total: 45 });
    const { user, currentUrl } = renderApp('/admin');

    await screen.findByText('Página 1 de 3');
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
    expect(currentUrl()).toBe('/admin?page=2');
    expect(queries.at(-1)).toBe('?page=2&pageSize=20');
  });

  it('a new filter goes back to page 1', async () => {
    mockSession({ loggedInAs: adminUser });
    mockAdminList(bookings, { total: 45 });
    const { user, currentUrl } = renderApp('/admin?page=3');

    await screen.findByText('Página 3 de 3');
    await user.selectOptions(screen.getByLabelText('Estado'), 'Borrador');

    expect(currentUrl()).toBe('/admin?status=draft');
  });

  it('says so when no booking matches', async () => {
    mockSession({ loggedInAs: adminUser });
    mockAdminList([]);
    renderApp('/admin?status=completed');

    expect(await screen.findByText('No hay reservas con estos filtros.')).toBeInTheDocument();
  });

  it('links each booking to its detail', async () => {
    mockSession({ loggedInAs: adminUser });
    mockAdminList();
    renderApp('/admin');

    const [firstRowLink] = await screen.findAllByRole('link', { name: /martes, 3 de noviembre/ });
    expect(firstRowLink).toHaveAttribute(
      'href',
      '/admin/reservas/00000000-0000-4000-8000-000000000001',
    );
  });
});

describe('Admin bookings list: confirmation email (Part 2.1)', () => {
  const email = (status: 'sent' | 'retrying' | 'failed', attempts: number) => ({
    status,
    attempts,
    maxAttempts: 6,
    lastError: status === 'sent' ? null : 'SMTP 421',
    sentAt: status === 'sent' ? '2026-11-02T13:30:05.000Z' : null,
    nextAttemptAt: '2026-11-02T13:31:00.000Z',
  });

  it('shows the email status of each booking', async () => {
    mockSession({ loggedInAs: adminUser });
    mockAdminList([
      adminBookingDto({ id: '00000000-0000-4000-8000-000000000001', email: email('sent', 1) }),
      adminBookingDto({ id: '00000000-0000-4000-8000-000000000002', email: email('retrying', 3) }),
      adminBookingDto({ id: '00000000-0000-4000-8000-000000000003', email: email('failed', 6) }),
      adminBookingDto({ id: '00000000-0000-4000-8000-000000000004', status: 'draft' }),
    ]);
    renderApp('/admin');

    const table = await screen.findByRole('table', { name: 'Reservas' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(table).getByRole('columnheader', { name: 'Correo' })).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent('Enviado');
    expect(rows[1]).toHaveTextContent('Reintentando (3 de 6 intentos)');
    expect(rows[2]).toHaveTextContent('Falló');
    expect(rows[3]).toHaveTextContent('Sin correo');
  });
});

describe('Admin access', () => {
  it('shows the "Reservas" link in the header to admins only', async () => {
    mockSession({ loggedInAs: adminUser });
    mockAdminList();
    renderApp('/');

    expect(await screen.findByRole('link', { name: 'Reservas' })).toHaveAttribute('href', '/admin');
  });

  it('hides the link from customers', async () => {
    mockSession({ loggedInAs: anaGomez });
    renderApp('/');

    await screen.findByRole('heading', { name: 'Cotiza tu sala' });
    expect(screen.queryByRole('link', { name: 'Reservas' })).not.toBeInTheDocument();
  });

  it('tells a customer who opens /admin that they have no access', async () => {
    mockSession({ loggedInAs: anaGomez });
    renderApp('/admin');

    expect(await screen.findByRole('heading', { name: 'No tienes permiso' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
