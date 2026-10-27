import { adminBookingsQuerySchema, adminCancelSchema } from '@lumni/shared';
import { Router } from 'express';
import type { AppDeps } from '../../deps';
import { requireRole } from '../../http/auth';
import { parseBookingId } from '../../http/params';
import {
  cancelBookingAsAdmin,
  completeBooking,
  getBookingForAdmin,
  listBookingsForAdmin,
} from './admin.service';

export function adminRouter({ db, now }: AppDeps) {
  const router = Router();
  router.use(requireRole('admin'));

  router.get('/bookings', async (req, res) => {
    res.json(await listBookingsForAdmin(db, adminBookingsQuerySchema.parse(req.query)));
  });

  router.get('/bookings/:id', async (req, res) => {
    res.json(await getBookingForAdmin(db, parseBookingId(req.params.id)));
  });

  router.post('/bookings/:id/cancel', async (req, res) => {
    const id = parseBookingId(req.params.id);
    const { reason } = adminCancelSchema.parse(req.body);
    res.json(await cancelBookingAsAdmin(db, id, reason));
  });

  router.post('/bookings/:id/complete', async (req, res) => {
    res.json(await completeBooking(db, parseBookingId(req.params.id), now()));
  });

  return router;
}
