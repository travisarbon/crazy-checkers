import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: [
      'src/ai/validation/**',        // Self-play: too slow for routine runs
      'src/engine/*.stresstest.*',    // Stress tests: also heavyweight
      'src/utils/perfBenchmark.*',    // Performance benchmarks: run via test:perf
      'src/ui/renderPerf.*',          // Render profiling: run via test:perf
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/test/**', 'src/vite-env.d.ts', 'src/main.tsx'],
      thresholds: {
        'src/engine/board.ts': { lines: 95 },
        'src/engine/moves.ts': { lines: 95 },
        'src/engine/rules.ts': { lines: 95 },
        'src/engine/game.ts': { lines: 95 },
        'src/engine/zobrist.ts': { lines: 95 },
        'src/ai/evaluator.ts': { lines: 95 },
      },
    },
  },
});
