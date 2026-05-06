import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.unit.test.ts', 'src/**/*.integration.test.ts'],
    globalSetup: ['./src/test/global-setup.integration.ts'],
    environment: 'node',
    passWithNoTests: true,
    fileParallelism: false,
    env: {
      DATABASE_URL: 'postgres://postgres:blindpass@localhost:5432/blindpass',
      TOTP_SECRET_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    },
    coverage: {
      provider: 'v8',
      include: [
        'src/plugins/auth.ts',
        'src/plugins/db.ts',
        'src/routes/auth/logout.ts',
        'src/routes/auth/sessions.ts',
        'src/routes/auth/start-login.ts',
        'src/routes/user/change-password.ts',
        'src/routes/user/delete-account.ts',
        'src/routes/user/keys.ts',
      ],
      exclude: ['src/types/**', 'src/**/*.test.ts', 'src/**/index.ts'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
      },
    },
  },
});
