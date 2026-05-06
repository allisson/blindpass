import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 60000,
    hookTimeout: 60000,
    passWithNoTests: true,
    exclude: ['dist/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/index.ts', '**/*.test.ts'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
      },
    },
  },
});
