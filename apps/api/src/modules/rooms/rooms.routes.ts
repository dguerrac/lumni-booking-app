import { Router } from 'express';
import type { AppDeps } from '../../deps';
import { listRoomsWithRates } from './rooms.service';

export function roomsRouter({ db }: AppDeps) {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await listRoomsWithRates(db));
  });

  return router;
}
