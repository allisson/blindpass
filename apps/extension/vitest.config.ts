import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
      },
    },
  },
});
