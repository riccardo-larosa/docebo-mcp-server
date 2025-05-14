import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Use Vitest globals (describe, it, expect, etc.)
    environment: 'node',
    clearMocks: true, // Clear mock history between tests
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'], // Files to include in coverage
      exclude: [ // Files/patterns to exclude
          'src/types.ts', // Example: exclude type definition files
          '**/*.d.ts',
       ],
    },
    // Optional: Setup file for global mocks or setup
    // setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.test.ts'], // Pattern for test files
  },
}); 