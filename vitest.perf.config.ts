import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Vitest configuration for performance benchmark tests only.
 * Used by `npm run test:perf`. Separate from the main config
 * so these heavyweight tests don't run in the default suite.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/utils/perfBenchmark.test.ts',
      'src/ui/renderPerf.test.tsx',
    ],
  },
});
