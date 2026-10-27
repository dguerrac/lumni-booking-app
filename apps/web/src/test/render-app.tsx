import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { AppRoutes } from '../router';

/** Renders the whole app (real routes, real providers) at a given URL. */
export function renderApp(path = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const user = userEvent.setup();
  let pathname = path;
  let search = '';

  function LocationSpy() {
    const location = useLocation();
    pathname = location.pathname;
    search = location.search;
    return null;
  }

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <LocationSpy />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { user, currentPath: () => pathname, currentUrl: () => pathname + search };
}
