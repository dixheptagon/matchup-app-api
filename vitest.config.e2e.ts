import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load .env and override DATABASE_URL with DATABASE_TEST_URL for E2E tests
config({ path: resolve(import.meta.dirname, '.env') });

if (process.env.DATABASE_TEST_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
}

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    testTimeout: 30000,
  },
});
