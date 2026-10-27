import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { anaGomez, mockRooms, mockSession, quoteResponse } from '../../test/fixtures';
import { renderApp } from '../../test/render-app';
import { server } from '../../test/server';

/** Answers POST /api/quotes with the given responses in order and records each request body. */
function mockQuotes(...responses: ReturnType<typeof quoteResponse>[]) {
  const requests: unknown[] = [];
  server.use(
    http.post('*/api/quotes', async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json(responses[Math.min(requests.length, responses.length) - 1]);
    }),
  );
  return requests;
}

async function fillAndQuote(user: ReturnType<typeof renderApp>['user']) {
  await screen.findByRole('option', { name: 'Sala Andes (hasta 4 personas)' });
  await user.selectOptions(screen.getByLabelText('Sala'), 'Sala Andes (hasta 4 personas)');
  await user.type(screen.getByLabelText('Fecha'), '2026-11-03');
  await user.selectOptions(screen.getByLabelText('Hora de inicio'), '09:00');
  await user.selectOptions(screen.getByLabelText('Duración'), '2 horas');
  await user.click(screen.getByRole('button', { name: 'Cotizar' }));
}

beforeEach(() => {
  mockSession({ loggedInAs: anaGomez });
  mockRooms();
});

describe('Quote screen', () => {
  it('sends the form as the shared request shape and shows the price of a bookable slot', async () => {
    const requests = mockQuotes(quoteResponse());
    const { user } = renderApp('/');

    await fillAndQuote(user);

    expect(await screen.findByRole('heading', { name: 'Disponible' })).toBeInTheDocument();
    expect(screen.getByTestId('quote-total')).toHaveTextContent('$80.000');
    expect(screen.getByRole('img', { name: /De 09:00 a 11:00/ })).toBeInTheDocument();
    expect(requests).toEqual([
      { roomId: 1, date: '2026-11-03', startTime: '09:00', durationHours: 2 },
    ]);
  });

  it('shows the discount and the Saturday surcharge when they apply', async () => {
    mockQuotes(
      quoteResponse({
        durationHours: 4,
        breakdown: {
          base: 280_000,
          discount: 28_000,
          surcharge: 63_000,
          extrasTotal: 0,
          total: 315_000,
        },
      }),
    );
    const { user } = renderApp('/');

    await fillAndQuote(user);

    const breakdown = await screen.findByRole('list', { name: 'Desglose del precio' });
    expect(within(breakdown).getByText('−$28.000')).toBeInTheDocument();
    expect(within(breakdown).getByText('+$63.000')).toBeInTheDocument();
    expect(screen.getByTestId('quote-total')).toHaveTextContent('$315.000');
  });

  it('explains why a slot is not bookable and applies the suggested slot', async () => {
    const requests = mockQuotes(
      quoteResponse({
        bookable: false,
        reasons: [{ code: 'SLOT_TAKEN', message: 'La sala ya está reservada en ese horario.' }],
        nextAvailable: { startTime: '11:00', endTime: '13:00' },
      }),
      quoteResponse({ startTime: '11:00' }),
    );
    const { user } = renderApp('/');

    await fillAndQuote(user);
    expect(await screen.findByRole('heading', { name: 'No disponible' })).toBeInTheDocument();
    expect(screen.getByText('La sala ya está reservada en ese horario.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Usar 11:00–13:00' }));

    expect(await screen.findByRole('heading', { name: 'Disponible' })).toBeInTheDocument();
    expect(screen.getByLabelText('Hora de inicio')).toHaveValue('11:00');
    expect(requests[1]).toMatchObject({ startTime: '11:00' });
  });

  it('says so when there is no other free slot that day', async () => {
    mockQuotes(
      quoteResponse({
        bookable: false,
        reasons: [{ code: 'CLOSED_DAY', message: 'El coworking no abre ese día.' }],
        dayHours: null,
      }),
    );
    const { user } = renderApp('/');

    await fillAndQuote(user);

    expect(await screen.findByText('El coworking no abre ese día.')).toBeInTheDocument();
    expect(
      screen.getByText('No hay otro horario libre ese día con esta duración.'),
    ).toBeInTheDocument();
  });

  it('asks for the missing fields before calling the API', async () => {
    const requests = mockQuotes(quoteResponse());
    const { user } = renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Cotizar' }));

    expect(await screen.findByText('Elige una sala.')).toBeInTheDocument();
    expect(screen.getByText('Elige una fecha.')).toBeInTheDocument();
    expect(requests).toEqual([]);
  });
});
