import type { BookingDto, BookingStepRequest, SlotRequest } from '@lumni/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch } from './client';

export const bookingKey = (id: string) => ['bookings', id] as const;
export const currentDraftKey = ['bookings', 'draft', 'current'] as const;

/** null when the customer has no unfinished draft (the API answers 404). */
async function fetchCurrentDraft(): Promise<BookingDto | null> {
  try {
    return await apiFetch<BookingDto>('/api/bookings/draft/current');
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function useCurrentDraft() {
  return useQuery({ queryKey: currentDraftKey, queryFn: fetchCurrentDraft });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: bookingKey(id),
    queryFn: () => apiFetch<BookingDto>(`/api/bookings/${id}`),
  });
}

export function useCreateDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slot: SlotRequest) =>
      apiFetch<BookingDto>('/api/bookings', { method: 'POST', body: slot }),
    onSuccess: (booking) => {
      queryClient.setQueryData(bookingKey(booking.id), booking);
      queryClient.setQueryData(currentDraftKey, booking);
    },
  });
}

/** Saves one wizard step; the response becomes the cached booking. */
export function useSaveStep(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BookingStepRequest) =>
      apiFetch<BookingDto>(`/api/bookings/${id}`, { method: 'PATCH', body: input }),
    onSuccess: (booking) => {
      queryClient.setQueryData(bookingKey(id), booking);
      queryClient.setQueryData(currentDraftKey, booking);
    },
  });
}

/** draft → confirmed. The server prices and freezes the booking; the response replaces the cache. */
export function useConfirmBooking(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<BookingDto>(`/api/bookings/${id}/confirm`, { method: 'POST' }),
    onSuccess: (booking) => {
      queryClient.setQueryData(bookingKey(id), booking);
      queryClient.setQueryData(currentDraftKey, null);
    },
    onError: (error) => {
      // Someone else confirmed this slot first: any quote on screen is now stale.
      if (error instanceof ApiError && error.code === 'SLOT_TAKEN') {
        void queryClient.invalidateQueries({ queryKey: ['quote'] });
      }
    },
  });
}

/** The customer discards their own draft. */
export function useDiscardDraft(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<BookingDto>(`/api/bookings/${id}/cancel`, { method: 'POST' }),
    onSuccess: (booking) => {
      queryClient.setQueryData(bookingKey(id), booking);
      queryClient.setQueryData(currentDraftKey, null);
    },
  });
}
