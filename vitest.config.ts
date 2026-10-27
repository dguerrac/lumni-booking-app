import { defineConfig } from 'vitest/config';

// Lets Vitest run from the repo root (npm test, editor extensions) while each
// app keeps its own config: the API uses Node + the test database, the web
// app uses jsdom + MSW.
export default defineConfig({
  test: {
    projects: ['apps/api', 'apps/web'],
    // Must live here: with projects, Vitest ignores this option inside a
    // project's config. API test files share one database and truncate
    // bookings, so they must run one at a time.
    fileParallelism: false,
  },
});
