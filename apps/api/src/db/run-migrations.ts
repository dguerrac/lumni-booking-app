import { requireEnv } from '../config/env';
import { migrateToLatest } from './migrator';

await migrateToLatest(requireEnv('DATABASE_URL'));
console.log('Migrations up to date.');
