import type { BookingExtras, BookingStatus, RoomSize, UserRole } from '@lumni/shared';
import type { ColumnType, Generated } from 'kysely';

// Hand-written to mirror the migrations. pg returns timestamptz as Date;
// inserts accept Date or an ISO string.
type NullableTimestamp = ColumnType<Date | null, Date | string | null, Date | string | null>;
/** Has a database default: optional on insert. */
type DefaultedTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface UsersTable {
  id: Generated<number>;
  email: string;
  password_hash: string;
  name: string;
  phone: string | null;
  company: string | null;
  role: UserRole;
  created_at: Generated<Date>;
}

export interface RoomsTable {
  id: Generated<number>;
  name: string;
  size: RoomSize;
  capacity: number;
}

export interface BookingsTable {
  id: Generated<string>;
  customer_id: number;
  room_id: number | null;
  starts_at: NullableTimestamp;
  ends_at: NullableTimestamp;
  party_size: number | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  company: string | null;
  extras: Generated<BookingExtras>;
  status: Generated<BookingStatus>;
  current_step: Generated<number>;
  base: number | null;
  discount: number | null;
  surcharge: number | null;
  extras_total: number | null;
  total: number | null;
  cancel_reason: string | null;
  confirmed_at: NullableTimestamp;
  cancelled_at: NullableTimestamp;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface Database {
  users: UsersTable;
  rooms: RoomsTable;
  bookings: BookingsTable;
}
