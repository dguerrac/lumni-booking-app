import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  anaGomez,
  bookingDto,
  DRAFT_ID,
  mockCurrentDraft,
  mockRooms,
  mockSession,
  quoteResponse,
} from '../../test/fixtures';
import { renderApp } from '../../test/render-app';
import { server } from '../../test/server';

// From a quote to a draft, and back to an unfinished draft.

async function quoteTuesdayMorning(user: ReturnType<typeof renderApp>['user']) {
  await screen.findByRole('option', { name: 'Sala Andes (hasta 4 personas)' });
  await user.selectOptions(screen.getByLabelText('Sala'), 'Sala Andes (hasta 4 personas)');
  await user.type(screen.getByLabelText('Fecha'), '2026-11-03');
  await user.click(screen.getByRole('button', { name: 'Cotizar' }));
}

beforeEach(() => {
  mockSession({ loggedInAs: anaGomez });
  mockRooms();
});

describe('Booking from a quote', () => {
  it('creates a draft with the quoted slot and opens the wizard', async () => {
    const created: unknown[] = [];
    server.use(
      http.post('*/api/quotes', () => HttpResponse.json(quoteResponse())),
      http.post('*/api/bookings', async ({ request }) => {
        created.push(await request.json());
        return HttpResponse.json(bookingDto(), { status: 201 });
      }),
      http.get(`*/api/bookings/${DRAFT_ID}`, () => HttpResponse.json(bookingDto())),
    );
    const { user, currentPath } = renderApp('/');

    await quoteTuesdayMorning(user);
    await user.click(await screen.findByRole('button', { name: 'Reservar este horario' }));

    await screen.findByRole('heading', { name: 'Tus datos' });
    expect(currentPath()).toBe(`/reservas/${DRAFT_ID}`);
    expect(created).toEqual([
      { roomId: 1, date: '2026-11-03', startTime: '09:00', durationHours: 2 },
    ]);
  });

  it('does not offer to book a slot that is not bookable', async () => {
    server.use(
      http.post('*/api/quotes', () =>
        HttpResponse.json(
          quoteResponse({
            bookable: false,
            reasons: [{ code: 'SLOT_TAKEN', message: 'La sala ya está reservada en ese horario.' }],
          }),
        ),
      ),
    );
    const { user } = renderApp('/');

    await quoteTuesdayMorning(user);

    await screen.findByRole('heading', { name: 'No disponible' });
    expect(screen.queryByRole('button', { name: 'Reservar este horario' })).not.toBeInTheDocument();
  });

  it('shows why the draft could not be created', async () => {
    server.use(
      http.post('*/api/quotes', () => HttpResponse.json(quoteResponse())),
      http.post('*/api/bookings', () =>
        HttpResponse.json(
          { error: { code: 'SLOT_NOT_VALID', message: 'Ese horario no se puede reservar.' } },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderApp('/');

    await quoteTuesdayMorning(user);
    await user.click(await screen.findByRole('button', { name: 'Reservar este horario' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ese horario no se puede reservar.');
  });
});

describe('Unfinished draft', () => {
  it('offers to continue an unfinished draft', async () => {
    mockCurrentDraft(bookingDto({ currentStep: 2 }));
    server.use(
      http.get(`*/api/bookings/${DRAFT_ID}`, () =>
        HttpResponse.json(bookingDto({ currentStep: 2 })),
      ),
    );
    const { user, currentPath } = renderApp('/');

    const banner = await screen.findByRole('region', { name: 'Tienes una reserva sin terminar' });
    expect(banner).toHaveTextContent('Sala Andes, martes, 3 de noviembre, de 09:00 a 11:00.');

    await user.click(screen.getByRole('link', { name: 'Continuar reserva' }));

    expect(currentPath()).toBe(`/reservas/${DRAFT_ID}`);
  });

  it('shows no banner when there is no draft', async () => {
    renderApp('/');

    await screen.findByRole('heading', { name: 'Cotiza tu sala' });
    expect(
      screen.queryByRole('region', { name: 'Tienes una reserva sin terminar' }),
    ).not.toBeInTheDocument();
  });
});
