import type { AdminBookingDto, AdminBookingPage, AdminBookingsQuery } from '@lumni/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';

export const adminBookingsKey = ['admin', 'bookings'] as const;

export function useAdminBookings(query: AdminBookingsQuery) {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.roomId) params.set('roomId', String(query.roomId));
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));

  return useQuery({
    queryKey: [...adminBookingsKey, query],
    queryFn: () => apiFetch<AdminBookingPage>(`/api/admin/bookings?${params}`),
    // Keep the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
}

export function useAdminBooking(id: string) {
  return useQuery({
    queryKey: [...adminBookingsKey, 'detail', id],
    queryFn: () => apiFetch<AdminBookingDto>(`/api/admin/bookings/${id}`),
  });
}
