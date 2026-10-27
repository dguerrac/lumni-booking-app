import { type Kysely, sql } from 'kysely';
import type { Database } from '../db/types';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitUntilBlocked(db: Kysely<Database>, count: number) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const { rows } = await sql<{ blocked: number }>`
      SELECT count(*)::int AS blocked FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
    `.execute(db);
    if ((rows[0]?.blocked ?? 0) >= count) return;
    await sleep(10);
  }
  throw new Error(`Expected ${count} requests to block on the lock; they never did.`);
}

/**
 * Makes "requests at the same time" deterministic instead of a timing
 * accident. It locks the given bookings, then starts each request in order,
 * waiting until it is blocked at its UPDATE before starting the next. Then it
 * releases the locks: PostgreSQL wakes the waiters in arrival order.
 *
 * Plain SELECTs don't block on these locks, so every request has already read
 * the booking by the time its UPDATE runs: exactly the race the conditional
 * UPDATE and the exclusion constraint must survive.
 */
export async function releaseTogether<const R extends readonly (() => PromiseLike<unknown>)[]>(
  db: Kysely<Database>,
  bookingIds: string[],
  requests: R,
): Promise<{ -readonly [K in keyof R]: Awaited<ReturnType<R[K]>> }> {
  const started: Promise<unknown>[] = [];

  await db.transaction().execute(async (trx) => {
    await sql`SELECT id FROM bookings WHERE id = ANY(${bookingIds}::uuid[]) FOR UPDATE`.execute(
      trx,
    );
    for (const [index, request] of requests.entries()) {
      // Promise.resolve() calls .then(), which is what actually sends a Supertest request.
      started.push(Promise.resolve(request()));
      await waitUntilBlocked(db, index + 1);
    }
  }); // commit: the locks are released and the blocked UPDATEs run

  // One result per request, in the same order (a typed tuple for destructuring).
  return Promise.all(started) as Promise<{ -readonly [K in keyof R]: Awaited<ReturnType<R[K]>> }>;
}
