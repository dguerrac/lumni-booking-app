import { bookingStepSchema, createBookingSchema } from '@lumni/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { AppDeps } from '../../deps';
import { requireAuth } from '../../http/auth';
import { NotFoundError } from '../../http/errors';
import {
  cancelOwnDraft,
  confirmBooking,
  createDraft,
  getCurrentDraft,
  getCustomerBooking,
  saveDraftStep,
} from './bookings.service';

/** A malformed id can't match any booking: answer 404, same as someone else's id. */
function parseBookingId(raw: string): string {
  const parsed = z.string().uuid().safeParse(raw);
  if (!parsed.success) throw new NotFoundError('BOOKING_NOT_FOUND', 'La reserva no existe.');
  return parsed.data;
}

// Every route uses req.user.id (the session) as the customer, never an id from the request.
export function bookingsRouter({ db, now }: AppDeps) {
  const router = Router();
  router.use(requireAuth);

  router.post('/', async (req, res) => {
    const slot = createBookingSchema.parse(req.body);
    res.status(201).json(await createDraft(db, req.user!.id, slot, now()));
  });

  router.get('/draft/current', async (req, res) => {
    res.json(await getCurrentDraft(db, req.user!.id));
  });

  router.get('/:id', async (req, res) => {
    res.json(await getCustomerBooking(db, parseBookingId(req.params.id), req.user!.id));
  });

  router.patch('/:id', async (req, res) => {
    const id = parseBookingId(req.params.id);
    const input = bookingStepSchema.parse(req.body);
    res.json(await saveDraftStep(db, id, req.user!.id, input, now()));
  });

  router.post('/:id/confirm', async (req, res) => {
    res.json(await confirmBooking(db, parseBookingId(req.params.id), req.user!.id, now()));
  });

  router.post('/:id/cancel', async (req, res) => {
    res.json(await cancelOwnDraft(db, parseBookingId(req.params.id), req.user!.id));
  });

  return router;
}
