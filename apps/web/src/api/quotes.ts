import type { QuoteRequest, QuoteResponse, RoomDto } from '@lumni/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';

export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: () => apiFetch<RoomDto[]>('/api/rooms'),
    staleTime: Infinity,
  });
}

/** A mutation because each quote is requested on demand (submit, or "use suggestion"). */
export function useQuote() {
  return useMutation({
    mutationFn: (input: QuoteRequest) =>
      apiFetch<QuoteResponse>('/api/quotes', { method: 'POST', body: input }),
  });
}
