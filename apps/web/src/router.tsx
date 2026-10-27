import { type RouteObject, useRoutes } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { RequireAuth } from './components/RequireAuth';
import { BookingWizardScreen } from './screens/BookingWizard';
import { LoginScreen } from './screens/Login';
import { QuoteScreen } from './screens/Quote';

// Exported as data so the app and the tests render exactly the same routes.
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginScreen /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <QuoteScreen /> },
          { path: 'reservas/:id', element: <BookingWizardScreen /> },
        ],
      },
    ],
  },
];

/**
 * Declarative routing (useRoutes inside BrowserRouter / MemoryRouter).
 * The app uses no loaders or actions, so React Router's data mode adds nothing,
 * and it builds a fetch Request on every navigation, which breaks under jsdom
 * on Node 24+ (jsdom's AbortSignal is not Node's).
 */
export function AppRoutes() {
  return useRoutes(routes);
}
