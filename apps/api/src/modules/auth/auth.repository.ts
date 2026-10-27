import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';

const PUBLIC_COLUMNS = ['id', 'email', 'name', 'phone', 'company', 'role'] as const;

export function findUserByEmail(db: Kysely<Database>, email: string) {
  return db
    .selectFrom('users')
    .select([...PUBLIC_COLUMNS, 'password_hash'])
    .where('email', '=', email)
    .executeTakeFirst();
}

export function findUserById(db: Kysely<Database>, id: number) {
  return db.selectFrom('users').select(PUBLIC_COLUMNS).where('id', '=', id).executeTakeFirst();
}
