import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../test/server';
import { ApiError, apiFetch } from './client';

describe('apiFetch', () => {
  it('returns the JSON body', async () => {
    server.use(http.get('*/api/health', () => HttpResponse.json({ status: 'ok' })));

    expect(await apiFetch('/api/health')).toEqual({ status: 'ok' });
  });

  it('returns undefined for 204 No Content', async () => {
    server.use(http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })));

    expect(await apiFetch('/api/auth/logout', { method: 'POST' })).toBeUndefined();
  });

  it('throws an ApiError with the code and message from the API', async () => {
    server.use(
      http.post('*/api/quotes', () =>
        HttpResponse.json(
          { error: { code: 'ROOM_NOT_FOUND', message: 'La sala no existe.' } },
          { status: 404 },
        ),
      ),
    );

    const error = await apiFetch('/api/quotes', { method: 'POST', body: {} }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      code: 'ROOM_NOT_FOUND',
      message: 'La sala no existe.',
    });
  });

  it('falls back to a generic Spanish message when the body is not the error shape', async () => {
    server.use(http.get('*/api/health', () => new HttpResponse('Bad gateway', { status: 502 })));

    await expect(apiFetch('/api/health')).rejects.toMatchObject({
      status: 502,
      code: 'UNKNOWN_ERROR',
      message: 'No pudimos completar la solicitud. Intenta de nuevo.',
    });
  });
});
