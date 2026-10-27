import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE users (
      id            serial PRIMARY KEY,
      email         text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      name          text NOT NULL,
      phone         text,
      company       text,
      role          text NOT NULL CHECK (role IN ('customer', 'admin')),
      created_at    timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  // Hourly rates live in the pricing config, not here: they are business
  // rules, and a rate change should not need a migration.
  await sql`
    CREATE TABLE rooms (
      id       serial PRIMARY KEY,
      name     text NOT NULL UNIQUE,
      size     text NOT NULL CHECK (size IN ('small', 'medium', 'large')),
      capacity int  NOT NULL CHECK (capacity > 0)
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE rooms`.execute(db);
  await sql`DROP TABLE users`.execute(db);
}
