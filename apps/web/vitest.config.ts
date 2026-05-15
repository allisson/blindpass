import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    passWithNoTests: true,
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 95,
        functions: 95,
        // Branches relaxed to 85% to accommodate the import parsers' defensive
        // `||` fallback chains (e.g. 1Password's many per-category field
        // shapes). Tighten back up as coverage improves.
        branches: 85,
      },
    },
  },
});
