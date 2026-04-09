import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/types/**'],
      thresholds: {
        statements: 50,
        lines: 50,
        functions: 80,
        branches: 70,
      },
    },
  },
});
