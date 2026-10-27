import bcrypt from 'bcryptjs';
import type { Kysely } from 'kysely';
import type { Database } from './types';

// Credentials are listed in the README so evaluators can log in.
export const SEED_USERS = [
  {
    email: 'cliente.a@lumni.test',
    password: 'ClienteA123!',
    name: 'Ana Gómez',
    phone: '3001234567',
    company: 'Andes Studio',
    role: 'customer',
  },
  {
    email: 'cliente.b@lumni.test',
    password: 'ClienteB123!',
    name: 'Bruno Díaz',
    phone: '3109876543',
    company: null,
    role: 'customer',
  },
  {
    email: 'admin@lumni.test',
    password: 'Admin123!',
    name: 'Admin Lumni',
    phone: null,
    company: 'Lumni Coworking',
    role: 'admin',
  },
] as const;

export const SEED_ROOMS = [
  { name: 'Sala Andes', size: 'small', capacity: 4 },
  { name: 'Sala Caribe', size: 'small', capacity: 4 },
  { name: 'Sala Pacífico', size: 'medium', capacity: 8 },
  { name: 'Sala Amazonas', size: 'medium', capacity: 8 },
  { name: 'Sala Orinoco', size: 'large', capacity: 16 },
] as const;

/** Idempotent: running it twice changes nothing. */
export async function seedDatabase(db: Kysely<Database>): Promise<void> {
  const users = await Promise.all(
    SEED_USERS.map(async ({ password, ...user }) => ({
      ...user,
      password_hash: await bcrypt.hash(password, 10),
    })),
  );

  await db
    .insertInto('users')
    .values(users)
    .onConflict((oc) => oc.column('email').doNothing())
    .execute();

  await db
    .insertInto('rooms')
    .values([...SEED_ROOMS])
    .onConflict((oc) => oc.column('name').doNothing())
    .execute();
}
