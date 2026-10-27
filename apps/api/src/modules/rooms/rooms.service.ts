import type { RoomDto } from '@lumni/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';
import { PRICING } from '../quotes/domain/pricing-config';
import { listRooms } from './rooms.repository';

/** Rooms with the hourly rate for their size (rates live in the pricing config, not the DB). */
export async function listRoomsWithRates(db: Kysely<Database>): Promise<RoomDto[]> {
  const rooms = await listRooms(db);
  return rooms.map((room) => ({ ...room, hourlyRate: PRICING.hourlyRates[room.size] }));
}
