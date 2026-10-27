import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Database } from './types';

export function createDb(connectionString: string) {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString }) }),
  });
}
