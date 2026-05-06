import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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
