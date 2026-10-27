import { Migrator } from 'kysely';
import { createDb } from './client';
import { migrations } from './migrations';

export async function migrateToLatest(connectionString: string): Promise<void> {
  const db = createDb(connectionString);
  const migrator = new Migrator({
    db,
    provider: { getMigrations: async () => migrations },
  });

  const { error, results } = await migrator.migrateToLatest();
  for (const result of results ?? []) {
    console.log(`${result.status.padEnd(7)} ${result.migrationName}`);
  }
  await db.destroy();

  if (error) throw error;
}
