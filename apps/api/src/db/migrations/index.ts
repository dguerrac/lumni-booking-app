import type { Migration } from 'kysely';
import * as m0001 from './0001_users_and_rooms';
import * as m0002 from './0002_bookings';
import * as m0003 from './0003_bookings_no_overlap';
import * as m0004 from './0004_rename_subtotal_to_base';
import * as m0005 from './0005_one_draft_per_customer';
import * as m0006 from './0006_email_outbox';

// Registered explicitly instead of read from the folder at runtime: works the
// same under tsx and Vitest, and the order is visible in one place.
// Add every new migration here.
export const migrations: Record<string, Migration> = {
  '0001_users_and_rooms': m0001,
  '0002_bookings': m0002,
  '0003_bookings_no_overlap': m0003,
  '0004_rename_subtotal_to_base': m0004,
  '0005_one_draft_per_customer': m0005,
  '0006_email_outbox': m0006,
};
