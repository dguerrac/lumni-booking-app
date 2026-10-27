import { requireEnv } from '../config/env';
import { createDb } from './client';
import { seedDatabase } from './seed';

const db = createDb(requireEnv('DATABASE_URL'));
await seedDatabase(db);
await db.destroy();
console.log('Seed done: 5 rooms, 2 customers, 1 admin.');
