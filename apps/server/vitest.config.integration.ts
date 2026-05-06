import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    globalSetup: ['./src/test/global-setup.integration.ts'],
    environment: 'node',
    passWithNoTests: true,
    fileParallelism: false,
    env: {
      DATABASE_URL: 'postgres://postgres:blindpass@localhost:5432/blindpass',
      TOTP_SECRET_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    },
  },
});
