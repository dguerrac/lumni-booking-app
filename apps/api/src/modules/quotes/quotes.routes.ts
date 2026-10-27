import { quoteRequestSchema } from '@lumni/shared';
import { Router } from 'express';
import type { AppDeps } from '../../deps';
import { createQuote } from './quotes.service';

export function quotesRouter({ db, now }: AppDeps) {
  const router = Router();

  router.post('/', async (req, res) => {
    const input = quoteRequestSchema.parse(req.body);
    res.json(await createQuote(db, input, now()));
  });

  return router;
}
