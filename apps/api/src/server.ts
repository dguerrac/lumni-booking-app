import { DateTime } from 'luxon';
import { createApp } from './app';
import { requireEnv } from './config/env';
import { createDb } from './db/client';
import { PRICING } from './modules/quotes/domain/pricing-config';

const port = Number(process.env.PORT ?? 3000);
const db = createDb(requireEnv('DATABASE_URL'));

createApp({
  db,
  now: () => DateTime.now().setZone(PRICING.timeZone),
  jwtSecret: requireEnv('JWT_SECRET'),
}).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
