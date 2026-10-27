import type { QuoteRequest, QuoteResponse, RoomDto } from '@lumni/shared';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
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

/**
 * A quote that follows its input (wizard step 3: the price updates as extras
 * change). Keeps showing the previous quote while the next one loads.
 */
export function useLiveQuote(input: QuoteRequest | null) {
  return useQuery({
    queryKey: ['quote', input],
    queryFn: () => apiFetch<QuoteResponse>('/api/quotes', { method: 'POST', body: input }),
    enabled: input !== null,
    placeholderData: keepPreviousData,
  });
}
