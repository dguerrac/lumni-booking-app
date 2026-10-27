import { defineConfig } from 'vitest/config';

try {
  process.loadEnvFile('../../.env');
} catch {
  // No .env file: use the real environment (for example in CI).
}

export default defineConfig({
  test: {
    globalSetup: ['./src/test/global-setup.ts'],
    // Test files share one database; run them one at a time so they
    // don't truncate each other's rows.
    fileParallelism: false,
  },
});
