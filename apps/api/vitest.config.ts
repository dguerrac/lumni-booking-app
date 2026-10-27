import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

try {
  // Resolved from this file, not the working directory, so it works from the repo root too.
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch {
  // No .env file: use the real environment (for example in CI).
}

export default defineConfig({
  test: {
    globalSetup: ['./src/test/global-setup.ts'],
    // Test files share one database; run them one at a time so they
    // don't truncate each other's rows. Applies when running from apps/api;
    // from the repo root the same setting lives in the root vitest.config.ts.
    fileParallelism: false,
  },
});
