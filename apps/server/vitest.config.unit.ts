import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.unit.test.ts'],
    environment: 'node',
    passWithNoTests: true,
    env: {
      DATABASE_URL: 'postgres://x:x@localhost:5432/x',
      TOTP_SECRET_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', 'src/**/*.test.ts', 'src/index.ts'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
      },
    },
  },
});
