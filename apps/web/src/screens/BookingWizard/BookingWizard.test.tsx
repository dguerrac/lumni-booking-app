import type { BookingDto, BookingStepRequest, QuoteRequest } from '@lumni/shared';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  anaGomez,
  bookingDto,
  DRAFT_ID,
  mockRooms,
  mockSession,
  quoteResponse,
} from '../../test/fixtures';
import { renderApp } from '../../test/render-app';
import { server } from '../../test/server';

/**
 * A fake booking API with state: PATCH applies the step like the real API
 * (simplified) and records each request, so tests check what was sent.
 */
function mockBookingApi(initial: BookingDto) {
  let booking = initial;
  const patches: BookingStepRequest[] = [];
  const quotes: QuoteRequest[] = [];

  server.use(
    http.get(`*/api/bookings/${initial.id}`, () => HttpResponse.json(booking)),
    http.patch(`*/api/bookings/${initial.id}`, async ({ request }) => {
      const body = (await request.json()) as BookingStepRequest;
      patches.push(body);
      const next = Math.max(booking.currentStep, Math.min(body.step + 1, 3)) as 1 | 2 | 3;
      if (body.step === 1) {
        const { contactName, contactEmail, contactPhone, company, partySize } = body.data;
        booking = {
          ...booking,
          currentStep: next,
          partySize,
          contact: {
            name: contactName,
            email: contactEmail,
            phone: contactPhone,
            company: company ?? null,
          },
        };
      } else if (body.step === 2) {
        booking = { ...booking, ...body.data, currentStep: next };
      } else {
        booking = { ...booking, extras: body.data, currentStep: next };
      }
      return HttpResponse.json(booking);
    }),
    http.post('*/api/quotes', async ({ request }) => {
      const body = (await request.json()) as QuoteRequest;
      quotes.push(body);
      const extrasTotal =
        (body.extras?.projector ? 30_000 : 0) + (body.extras?.coffee ?? 0) * 8_000;
      return HttpResponse.json(
        quoteResponse({
          ...body,
          breakdown: {
            base: 80_000,
            discount: 0,
            surcharge: 0,
            extrasTotal,
            total: 80_000 + extrasTotal,
          },
        }),
      );
    }),
  );

  return { patches, quotes };
}

const stepHeading = (name: string) => screen.findByRole('heading', { name, level: 2 });

beforeEach(() => {
  mockSession({ loggedInAs: anaGomez });
  mockRooms();
});

describe('Booking wizard', () => {
  it('opens at the step saved on the server (survives a reload or another device)', async () => {
    mockBookingApi(bookingDto({ currentStep: 2, partySize: 3 }));
    renderApp(`/reservas/${DRAFT_ID}`);

    expect(await stepHeading('Sala y horario')).toBeInTheDocument();
    const stepper = screen.getByRole('list', { name: 'Pasos de la reserva' });
    expect(within(stepper).getByText('Sala y horario').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('step 1: prefills the contact data, saves it and moves to step 2', async () => {
    const { patches } = mockBookingApi(bookingDto());
    const { user } = renderApp(`/reservas/${DRAFT_ID}`);

    await stepHeading('Tus datos');
    expect(screen.getByLabelText('Nombre')).toHaveValue('Ana Gómez');
    expect(screen.getByLabelText('Correo')).toHaveValue('cliente.a@lumni.test');

    await user.type(screen.getByLabelText('Personas que asisten'), '3');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await stepHeading('Sala y horario')).toBeInTheDocument();
    expect(patches).toEqual([
      {
        step: 1,
        data: {
          contactName: 'Ana Gómez',
          contactEmail: 'cliente.a@lumni.test',
          contactPhone: '3001234567',
          company: 'Andes Studio',
          partySize: 3,
        },
      },
    ]);
  });

  it('step 1: asks for the party size before saving', async () => {
    const { patches } = mockBookingApi(bookingDto());
    const { user } = renderApp(`/reservas/${DRAFT_ID}`);

    await stepHeading('Tus datos');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('Indica cuántas personas asisten.')).toBeInTheDocument();
    expect(patches).toEqual([]);
  });

  it("shows the API's reasons when a rule is broken", async () => {
    mockBookingApi(bookingDto());
    server.use(
      http.patch(`*/api/bookings/${DRAFT_ID}`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'DRAFT_NOT_VALID',
              message: 'Revisa los datos de la reserva.',
              details: [
                { code: 'PARTY_TOO_LARGE', message: 'La sala elegida es para máximo 4 personas.' },
              ],
            },
          },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderApp(`/reservas/${DRAFT_ID}`);

    await stepHeading('Tus datos');
    await user.type(screen.getByLabelText('Personas que asisten'), '6');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La sala elegida es para máximo 4 personas.',
    );
    expect(screen.getByRole('heading', { name: 'Tus datos', level: 2 })).toBeInTheDocument();
  });

  it('step 2: prefills the slot, saves a change and moves to step 3', async () => {
    const { patches } = mockBookingApi(bookingDto({ currentStep: 2, partySize: 3 }));
    const { user } = renderApp(`/reservas/${DRAFT_ID}`);

    await stepHeading('Sala y horario');
    await screen.findByRole('option', { name: 'Sala Andes (hasta 4 personas)' });
    expect(screen.getByLabelText('Sala')).toHaveDisplayValue('Sala Andes (hasta 4 personas)');
    expect(screen.getByLabelText('Fecha')).toHaveValue('2026-11-03');

    await user.selectOptions(screen.getByLabelText('Hora de inicio'), '10:00');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await stepHeading('Extras y confirmación')).toBeInTheDocument();
    expect(patches).toEqual([
      { step: 2, data: { roomId: 1, date: '2026-11-03', startTime: '10:00', durationHours: 2 } },
    ]);
  });

  it('"Atrás" goes to the previous step without saving', async () => {
    const { patches } = mockBookingApi(bookingDto({ currentStep: 2, partySize: 3 }));
    const { user } = renderApp(`/reservas/${DRAFT_ID}`);

    await stepHeading('Sala y horario');
    await user.click(screen.getByRole('button', { name: 'Atrás' }));

    expect(await stepHeading('Tus datos')).toBeInTheDocument();
    expect(screen.getByLabelText('Personas que asisten')).toHaveValue(3);
    expect(patches).toEqual([]);
  });

  it('step 3: prices the extras live with the quoter and saves them', async () => {
    const { patches, quotes } = mockBookingApi(bookingDto({ currentStep: 3, partySize: 3 }));
    const { user } = renderApp(`/reservas/${DRAFT_ID}`);

    await stepHeading('Extras y confirmación');
    expect(await screen.findByTestId('quote-total')).toHaveTextContent('$80.000');

    await user.click(screen.getByLabelText('Proyector'));
    await user.clear(screen.getByLabelText('Cafés'));
    await user.type(screen.getByLabelText('Cafés'), '2');

    expect(await screen.findByText('$126.000')).toBeInTheDocument();
    expect(quotes.at(-1)).toEqual({
      roomId: 1,
      date: '2026-11-03',
      startTime: '09:00',
      durationHours: 2,
      extras: { projector: true, coffee: 2 },
    });

    await user.click(screen.getByRole('button', { name: 'Confirmar reserva' }));

    expect(patches).toEqual([{ step: 3, data: { projector: true, coffee: 2 } }]);
  });

  it('says so when the booking does not exist or is not yours', async () => {
    server.use(
      http.get(`*/api/bookings/${DRAFT_ID}`, () =>
        HttpResponse.json(
          { error: { code: 'BOOKING_NOT_FOUND', message: 'La reserva no existe.' } },
          { status: 404 },
        ),
      ),
    );
    renderApp(`/reservas/${DRAFT_ID}`);

    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta reserva' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a cotizar' })).toBeInTheDocument();
  });
});
