import { DateTime } from 'luxon';
import { createApp } from './app';
import { type Env, parseEnv } from './config/env';
import { createDb } from './db/client';
import { failFirst, smtpSender } from './modules/emails/email-sender';
import { startEmailWorker } from './modules/emails/email-worker-loop';
import { PRICING } from './modules/quotes/domain/pricing-config';

let env: Env;
try {
  env = parseEnv(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const db = createDb(env.DATABASE_URL);

const server = createApp({
  db,
  now: () => DateTime.now().setZone(PRICING.timeZone),
  jwtSecret: env.JWT_SECRET,
}).listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});

// The confirmation email worker runs in the same process (Part 2.1).
const sender = failFirst(
  env.EMAIL_FAIL_FIRST_N,
  smtpSender({ host: env.SMTP_HOST, port: env.SMTP_PORT, from: env.EMAIL_FROM }),
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
