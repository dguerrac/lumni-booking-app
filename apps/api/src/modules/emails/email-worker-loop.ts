import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';
import type { EmailSender } from './email-sender';
import { processDueEmails } from './outbox-worker';

type Options = {
  db: Kysely<Database>;
  sender: EmailSender;
  intervalMs?: number;
  log?: (...args: unknown[]) => void;
  /** Test hook: called after every pass. */
  onPass?: () => void;
};

/**
 * Runs the outbox worker every `intervalMs` inside the API process. A pass
 * starts only after the previous one finished (setTimeout, not setInterval),
 * so passes never overlap in this process; several processes can still run
 * it safely thanks to FOR UPDATE SKIP LOCKED. A failing pass is logged and
 * the loop keeps going.
 */
export function startEmailWorker({
  db,
  sender,
  intervalMs = 2000,
  log = console.error,
  onPass,
}: Options) {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<void> = Promise.resolve();

  const pass = async () => {
    try {
      const summary = await processDueEmails({ db, sender, now: new Date() });
      if (summary.sent + summary.retrying + summary.failed > 0) {
        console.info('[email-worker]', summary);
      }
    } catch (error) {
      log('[email-worker] pass failed, retrying on the next tick:', error);
    }
    onPass?.();
  };

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(() => {
      running = pass().then(schedule);
    }, intervalMs);
  };

  schedule();

  return {
    /** Stops scheduling and waits for the pass in progress, if any. */
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await running;
    },
  };
}
