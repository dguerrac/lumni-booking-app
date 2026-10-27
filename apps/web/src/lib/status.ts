import type { BookingStatus } from '@lumni/shared';

export const STATUS_LABELS: Record<BookingStatus, string> = {
  draft: 'Borrador',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
};
