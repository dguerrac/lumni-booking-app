import type { BookingExtras, BookingStatus, RoomSize, UserRole } from '@lumni/shared';
import type { ColumnType, Generated } from 'kysely';

// Hand-written to mirror the migrations. pg returns timestamptz as Date;
// inserts accept Date or an ISO string.
type Timestamp = ColumnType<Date, Date | string, Date | string>;
type NullableTimestamp = ColumnType<Date | null, Date | string | null, Date | string | null>;

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
  subtotal: number | null;
  discount: number | null;
  surcharge: number | null;
  extras_total: number | null;
  total: number | null;
  cancel_reason: string | null;
  confirmed_at: NullableTimestamp;
  cancelled_at: NullableTimestamp;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface Database {
  users: UsersTable;
  rooms: RoomsTable;
  bookings: BookingsTable;
}
