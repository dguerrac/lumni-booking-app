import type {
  AdminBookingDto,
  AdminBookingPage,
  AdminBookingsQuery,
  AdminCancelRequest,
} from '@lumni/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

/** The response replaces the cached detail; the list is refetched (status and filters changed). */
function useAdminAction(id: string, action: 'cancel' | 'complete') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body?: AdminCancelRequest) =>
      apiFetch<AdminBookingDto>(`/api/admin/bookings/${id}/${action}`, { method: 'POST', body }),
    onSuccess: (booking) => {
      queryClient.setQueryData([...adminBookingsKey, 'detail', id], booking);
      void queryClient.invalidateQueries({ queryKey: adminBookingsKey, exact: false });
    },
  });
}

export const useAdminCancel = (id: string) => useAdminAction(id, 'cancel');
export const useAdminComplete = (id: string) => useAdminAction(id, 'complete');
