import type { Kysely } from 'kysely';
import type { DateTime } from 'luxon';
import type { Database } from './db/types';

/** What the app needs from the outside world. Tests pass a test DB, a frozen clock and a test secret. */
export type AppDeps = {
  db: Kysely<Database>;
  now: () => DateTime;
  jwtSecret: string;
};
