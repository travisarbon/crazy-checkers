import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/ai/validation/**/*.test.ts'],
    exclude: [],
  },
});
