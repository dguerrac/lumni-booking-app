import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { anaGomez, mockRooms, mockSession } from '../../test/fixtures';
import { renderApp } from '../../test/render-app';

beforeEach(() => {
  mockRooms(); // the quote screen (home) loads them after login
});

describe('Login screen', () => {
  it('sends a visitor without a session to the login screen', async () => {
    mockSession({ loggedInAs: null });
    const { currentPath } = renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument();
    expect(currentPath()).toBe('/login');
  });

  it('logs in and lands on the quote screen with the user name in the header', async () => {
    mockSession({ loggedInAs: null });
    const { user } = renderApp('/');

    await user.type(await screen.findByLabelText('Correo'), 'cliente.a@lumni.test');
    await user.type(screen.getByLabelText('Contraseña'), 'ClienteA123!');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByRole('heading', { name: 'Cotiza tu sala' })).toBeInTheDocument();
    expect(screen.getByText(anaGomez.name)).toBeInTheDocument();
  });

  it('shows the API message when the password is wrong', async () => {
    mockSession({ loggedInAs: null });
    const { user } = renderApp('/login');

    await user.type(await screen.findByLabelText('Correo'), 'cliente.a@lumni.test');
    await user.type(screen.getByLabelText('Contraseña'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
  });

  it('validates the fields with the shared schema before calling the API', async () => {
    mockSession({ loggedInAs: null });
    const { user } = renderApp('/login');

    await user.type(await screen.findByLabelText('Correo'), 'no-es-un-correo');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByText('Escribe un correo válido.')).toBeInTheDocument();
    expect(screen.getByText('Escribe tu contraseña.')).toBeInTheDocument();
  });

  it('fills the form from a test account button', async () => {
    mockSession({ loggedInAs: null });
    const { user } = renderApp('/login');

    await user.click(await screen.findByRole('button', { name: 'Ana Gómez, cliente' }));

    expect(screen.getByLabelText('Correo')).toHaveValue('cliente.a@lumni.test');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('ClienteA123!');
  });

  it('logs out from the header', async () => {
    mockSession({ loggedInAs: anaGomez });
    const { user } = renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument();
  });
});
