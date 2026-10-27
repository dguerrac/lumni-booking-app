import { requireEnv } from '../config/env';
import { createDb } from '../db/client';
import { migrateToLatest } from '../db/migrator';
import { seedDatabase } from '../db/seed';

// Runs once before all API tests: brings the real test database to the latest
// schema and loads the seed users and rooms.
export default async function setup(): Promise<void> {
  const url = requireEnv('TEST_DATABASE_URL');
  await migrateToLatest(url);

  const db = createDb(url);
  await seedDatabase(db);
  await db.destroy();
}
