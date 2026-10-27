import { screen } from '@testing-library/react';
import { delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/render-app';
import { server } from '../../test/server';

describe('RequireAuth', () => {
  it('shows a loading state while it checks the session', async () => {
    server.use(http.get('*/api/auth/me', () => delay('infinite')));
    renderApp('/');

    expect(await screen.findByRole('status')).toHaveTextContent('Cargando…');
    expect(screen.queryByRole('heading', { name: 'Inicia sesión' })).not.toBeInTheDocument();
  });
});
