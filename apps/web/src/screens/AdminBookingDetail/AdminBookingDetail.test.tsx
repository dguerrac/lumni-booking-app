import type { AdminBookingDto } from '@lumni/shared';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { adminBookingDto, adminUser, mockRooms, mockSession } from '../../test/fixtures';
import { renderApp } from '../../test/render-app';
import { server } from '../../test/server';

const ID = '00000000-0000-4000-8000-000000000001';

/** A stateful admin booking API: cancel and complete change it like the real one. */
function mockAdminBooking(
  initial: AdminBookingDto,
  { completeFails = false }: { completeFails?: boolean } = {},
) {
  let booking = initial;
  const writes: { action: string; body?: unknown }[] = [];
  server.use(
    http.post(`*/api/admin/bookings/${ID}/email/retry`, () => {
      writes.push({ action: 'retry-email' });
      booking = { ...booking, email: { ...booking.email!, status: 'pending', attempts: 0 } };
      return HttpResponse.json(booking);
    }),
    http.get(`*/api/admin/bookings/${ID}`, () => HttpResponse.json(booking)),
    http.post(`*/api/admin/bookings/${ID}/cancel`, async ({ request }) => {
      const body = (await request.json()) as { reason: string };
      writes.push({ action: 'cancel', body });
      booking = {
        ...booking,
        status: 'cancelled',
        cancelReason: body.reason,
        cancelledAt: '2026-11-02T14:00:00.000Z',
      };
      return HttpResponse.json(booking);
    }),
    http.post(`*/api/admin/bookings/${ID}/complete`, () => {
      writes.push({ action: 'complete' });
      if (completeFails) {
        return HttpResponse.json(
          {
            error: {
              code: 'BOOKING_NOT_FINISHED',
              message: 'Solo se puede completar una reserva que ya terminó.',
            },
          },
          { status: 409 },
        );
      }
      booking = { ...booking, status: 'completed' };
      return HttpResponse.json(booking);
    }),
  );
  return writes;
}

beforeEach(() => {
  mockSession({ loggedInAs: adminUser });
  mockRooms();
});

const failedEmail = {
  status: 'failed' as const,
  attempts: 6,
  maxAttempts: 6,
  lastError: 'SMTP 550: buzón no existe',
  sentAt: null,
  nextAttemptAt: '2026-11-02T13:33:00.000Z',
};

describe('Admin booking detail: confirmation email (Part 2.1)', () => {
  it('shows a sent email with when it was sent', async () => {
    mockAdminBooking(
      adminBookingDto({
        id: ID,
        email: {
          ...failedEmail,
          status: 'sent',
          attempts: 1,
          lastError: null,
          sentAt: '2026-11-02T13:30:05.000Z',
        },
      }),
    );
    renderApp(`/admin/reservas/${ID}`);

    const section = await screen.findByRole('region', { name: 'Correo de confirmación' });
    expect(section).toHaveTextContent('Enviado');
    expect(section).toHaveTextContent('2 de noviembre de 2026');
    expect(within(section).queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows why a failed email failed and sends it again on request', async () => {
    const writes = mockAdminBooking(adminBookingDto({ id: ID, email: failedEmail }));
    const { user } = renderApp(`/admin/reservas/${ID}`);

    const section = await screen.findByRole('region', { name: 'Correo de confirmación' });
    expect(section).toHaveTextContent('Falló');
    expect(section).toHaveTextContent('6 de 6 intentos');
    expect(section).toHaveTextContent('SMTP 550: buzón no existe');

    await user.click(within(section).getByRole('button', { name: 'Reintentar envío' }));

    expect(await within(section).findByText('En cola')).toBeInTheDocument();
    expect(writes).toEqual([{ action: 'retry-email' }]);
  });

  it('says there is no email for a booking that was never confirmed', async () => {
    mockAdminBooking(adminBookingDto({ id: ID, status: 'draft', email: null }));
    renderApp(`/admin/reservas/${ID}`);

    const section = await screen.findByRole('region', { name: 'Correo de confirmación' });
    expect(section).toHaveTextContent('Se envía al confirmar la reserva.');
  });
});

describe('Admin booking detail', () => {
  it('shows the booking, its customer and the agreed price', async () => {
    mockAdminBooking(
      adminBookingDto({
        id: ID,
        extras: { projector: true, coffee: 3 },
        price: { base: 80_000, discount: 0, surcharge: 0, extrasTotal: 54_000, total: 134_000 },
      }),
    );
    renderApp(`/admin/reservas/${ID}`);

    expect(
      await screen.findByRole('heading', { name: 'martes, 3 de noviembre, 09:00–11:00' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Confirmada')).toBeInTheDocument();
    const customer = screen.getByRole('region', { name: 'Cliente' });
    expect(customer).toHaveTextContent('Ana Gómez');
    expect(customer).toHaveTextContent('cliente.a@lumni.test');
    expect(customer).toHaveTextContent('3001234567');
    const details = screen.getByRole('region', { name: 'Reserva' });
    expect(details).toHaveTextContent('Sala Andes');
    expect(details).toHaveTextContent('3 personas');
    expect(details).toHaveTextContent('Proyector, café para 3');
    expect(screen.getByRole('region', { name: 'Precio acordado' })).toHaveTextContent('$134.000');
  });

  it('shows why a cancelled booking was cancelled, and offers no actions', async () => {
    mockAdminBooking(
      adminBookingDto({
        id: ID,
        status: 'cancelled',
        cancelReason: 'Mantenimiento de la sala',
        cancelledAt: '2026-11-02T14:00:00.000Z',
      }),
    );
    renderApp(`/admin/reservas/${ID}`);

    expect(await screen.findByText('Mantenimiento de la sala')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar reserva' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Marcar como completada' }),
    ).not.toBeInTheDocument();
  });

  it('cancels only with a reason', async () => {
    const writes = mockAdminBooking(adminBookingDto({ id: ID }));
    const { user } = renderApp(`/admin/reservas/${ID}`);

    await user.click(await screen.findByRole('button', { name: 'Cancelar reserva' }));
    const form = screen.getByRole('form', { name: 'Cancelar reserva' });
    await user.click(within(form).getByRole('button', { name: 'Confirmar cancelación' }));

    expect(
      await screen.findByText('Escribe el motivo de la cancelación (mínimo 5 caracteres).'),
    ).toBeInTheDocument();
    expect(writes).toEqual([]);

    await user.type(within(form).getByLabelText('Motivo'), 'Mantenimiento de la sala');
    await user.click(within(form).getByRole('button', { name: 'Confirmar cancelación' }));

    expect(await screen.findByText('Cancelada')).toBeInTheDocument();
    expect(screen.getByText('Mantenimiento de la sala')).toBeInTheDocument();
    expect(writes).toEqual([{ action: 'cancel', body: { reason: 'Mantenimiento de la sala' } }]);
  });

  it('can step back from cancelling', async () => {
    const writes = mockAdminBooking(adminBookingDto({ id: ID }));
    const { user } = renderApp(`/admin/reservas/${ID}`);

    await user.click(await screen.findByRole('button', { name: 'Cancelar reserva' }));
    await user.click(screen.getByRole('button', { name: 'No cancelar' }));

    expect(screen.queryByRole('form', { name: 'Cancelar reserva' })).not.toBeInTheDocument();
    expect(writes).toEqual([]);
  });

  it('marks a finished booking as completed', async () => {
    const writes = mockAdminBooking(adminBookingDto({ id: ID }));
    const { user } = renderApp(`/admin/reservas/${ID}`);

    await user.click(await screen.findByRole('button', { name: 'Marcar como completada' }));

    expect(await screen.findByText('Completada')).toBeInTheDocument();
    expect(writes).toEqual([{ action: 'complete' }]);
  });

  it("shows the API's reason when it can't be completed yet", async () => {
    mockAdminBooking(adminBookingDto({ id: ID }), { completeFails: true });
    const { user } = renderApp(`/admin/reservas/${ID}`);

    await user.click(await screen.findByRole('button', { name: 'Marcar como completada' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Solo se puede completar una reserva que ya terminó.',
    );
  });

  it('says so when the booking does not exist', async () => {
    server.use(
      http.get(`*/api/admin/bookings/${ID}`, () =>
        HttpResponse.json(
          { error: { code: 'BOOKING_NOT_FOUND', message: 'La reserva no existe.' } },
          { status: 404 },
        ),
      ),
    );
    renderApp(`/admin/reservas/${ID}`);

    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta reserva' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a la lista' })).toHaveAttribute(
      'href',
      '/admin',
    );
  });
});
