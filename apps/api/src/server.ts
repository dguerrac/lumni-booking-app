import { DateTime } from 'luxon';
import { createApp } from './app';
import { requireEnv } from './config/env';
import { createDb } from './db/client';
import { failFirst, smtpSender } from './modules/emails/email-sender';
import { startEmailWorker } from './modules/emails/email-worker-loop';
import { PRICING } from './modules/quotes/domain/pricing-config';

const port = Number(process.env.PORT ?? 3000);
const db = createDb(requireEnv('DATABASE_URL'));

const server = createApp({
  db,
  now: () => DateTime.now().setZone(PRICING.timeZone),
  jwtSecret: requireEnv('JWT_SECRET'),
}).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

// The confirmation email worker runs in the same process (Part 2.1).
const sender = failFirst(
  Number(process.env.EMAIL_FAIL_FIRST_N ?? 0),
  smtpSender({
    host: requireEnv('SMTP_HOST'),
    port: Number(requireEnv('SMTP_PORT')),
    from: requireEnv('EMAIL_FROM'),
  }),
);
const emailWorker = startEmailWorker({ db, sender });

// Graceful shutdown: stop taking requests, let the worker finish its pass, close the pool.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    server.close();
    await emailWorker.stop();
    await db.destroy();
    process.exit(0);
  });
}
