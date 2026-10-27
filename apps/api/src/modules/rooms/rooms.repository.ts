import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';

export function listRooms(db: Kysely<Database>) {
  return db.selectFrom('rooms').select(['id', 'name', 'size', 'capacity']).orderBy('id').execute();
}

export function findRoomById(db: Kysely<Database>, id: number) {
  return db
    .selectFrom('rooms')
    .select(['id', 'name', 'size', 'capacity'])
    .where('id', '=', id)
    .executeTakeFirst();
}
