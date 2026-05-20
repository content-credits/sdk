import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/types/**',
        'src/comments/panel.ts',  // large DOM-heavy UI panel — integration test candidate
        'src/auth/popup.ts',      // browser popup window — not unit-testable
      ],
      thresholds: {
        statements: 50,
        lines: 50,
        functions: 75,
        branches: 70,
      },
    },
  },
});
