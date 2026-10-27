/** The API's error shape: { error: { code, message, details? } }. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

type Options = { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown };

/**
 * fetch wrapper for the API. Same origin (Vite proxies /api), so the session
 * cookie goes along automatically. Throws ApiError for any non-2xx response.
 */
export async function apiFetch<T>(
  path: string,
  { method = 'GET', body }: Options = {},
): Promise<T> {
  const res = await fetch(new URL(path, window.location.origin), {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = data?.error;
    throw new ApiError(
      res.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? 'No pudimos completar la solicitud. Intenta de nuevo.',
      error?.details,
    );
  }
  return data as T;
}
