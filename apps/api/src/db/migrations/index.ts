import type { Migration } from 'kysely';
import * as m0001 from './0001_users_and_rooms';
import * as m0002 from './0002_bookings';
import * as m0003 from './0003_bookings_no_overlap';

// Registered explicitly instead of read from the folder at runtime: works the
// same under tsx and Vitest, and the order is visible in one place.
// Add every new migration here.
export const migrations: Record<string, Migration> = {
  '0001_users_and_rooms': m0001,
  '0002_bookings': m0002,
  '0003_bookings_no_overlap': m0003,
};
