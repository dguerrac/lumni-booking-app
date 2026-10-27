import type { RoomSize } from './index';

/** A room as the API returns it. hourlyRate is in integer COP. */
export type RoomDto = {
  id: number;
  name: string;
  size: RoomSize;
  capacity: number;
  hourlyRate: number;
};
