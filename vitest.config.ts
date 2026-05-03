import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'scripts/audit-css-colors.test.ts',
    ],
    exclude: [
      'src/ai/validation/**',        // Self-play: too slow for routine runs
      'src/engine/*.stresstest.*',    // Stress tests: also heavyweight
      'src/utils/perfBenchmark.*',    // Performance benchmarks: run via test:perf
      'src/ui/renderPerf.*',          // Render profiling: run via test:perf
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/test/**',
        'src/vite-env.d.ts',
        'src/main.tsx',
        'src/engine/classified/stacking/testHelpers.ts',
        'src/engine/classified/stacking/fixtures/**',
        'src/engine/classified/linear/testHelpers.ts',
        'src/engine/classified/linear/fixtures/**',
        'src/engine/classified/alquerque/testHelpers.ts',
        'src/engine/classified/alquerque/fixtures/**',
        'src/engine/classified/custodian/testHelpers.ts',
        'src/engine/classified/custodian/fixtures/**',
        'src/engine/classified/harzdame/testHelpers.ts',
        'src/engine/classified/harzdame/fixtures/**',
        'src/engine/classified/cheskers/testHelpers.ts',
        'src/engine/classified/cheskers/fixtures/**',
      ],
      thresholds: {
        'src/engine/board.ts': { lines: 95 },
        'src/engine/moves.ts': { lines: 95 },
        'src/engine/rules.ts': { lines: 95 },
        'src/engine/game.ts': { lines: 95 },
        'src/engine/zobrist.ts': { lines: 95 },
        'src/ai/evaluator.ts': { lines: 95 },
        'src/engine/adjacency/**': { lines: 95, branches: 90 },
        'src/engine/coordinates/**': { lines: 95, branches: 90 },
        // Stacking engine: 95% lines, 80% branches.
        // The branch target is lower than adjacency/coordinates (which use 90)
        // because the stacking module has many typed-error fallbacks that are
        // defensive against malformed-state inputs and not realistically
        // reachable from generator-produced moves.
        'src/engine/classified/stacking/**': { lines: 95, branches: 80 },
        // Linear-movement engine (Dameo): same rationale as stacking — many
        // typed-error guards exist for malformed-state inputs that the
        // generator never produces.
        'src/engine/classified/linear/**': { lines: 95, branches: 80 },
        // Alquerque engine (Zamma): same rationale as stacking + linear.
        'src/engine/classified/alquerque/**': { lines: 95, branches: 80 },
        // Custodian engine (Mak-yek, Hasami Shogi, Rek, Dai Hasami Shogi):
        // same rationale as stacking + linear + alquerque.
        'src/engine/classified/custodian/**': { lines: 95, branches: 80 },
        // Harzdame engine (Tier 2 #12 Harz Draughts): same rationale as the
        // other Tier 2 engines — many defensive guards (invalid owner / kind,
        // unparsable PDN labels, serializer schema mismatches) that aren't
        // reachable from the generator's outputs but are exercised by the
        // coverage-gap suite. The single-piece capture-stamp branch in
        // HarzdameRules has a never-reached early-return because Harzdame's
        // capture obligation drops step moves whenever captures exist.
        'src/engine/classified/harzdame/**': { lines: 95, branches: 80 },
        // Cheskers engine (Tier 2 #49, Solomon Golomb 1948): same rationale
        // as the other Tier 2 engines — many defensive guards exist for
        // malformed-state inputs that the generator never produces.
        'src/engine/classified/cheskers/**': { lines: 95, branches: 80 },
        // Tier 2 per-game registration plumbing (Task 29.7). Branch
        // threshold is low because each per-game registration file is
        // mostly literal registration-spec data with one optional-chaining
        // branch (`options?.replace`); v8 counts each `?.` and ternary in
        // the synthesised cogitate-geometry helper as branches that the
        // tier 2 stub-adapter unit tests don't exercise (only the 8x8
        // `dims.square` branch fires). Per plan §10.6 spirit.
        'src/engine/classified/tier2/**': { lines: 85, branches: 50 },
        // Tier 2 AI evaluators (Task 29.7). Lower threshold than engines
        // because most lines are weight-multiplications without conditional
        // logic. The defensive `throw` paths in dispatch + the unreachable
        // mid-game branches in evaluators contribute uncovered branches.
        'src/ai/evaluators/tier2/**': { lines: 85, branches: 75 },
        // Tier 2 notation adapters (Task 29.8). Lower threshold than engines
        // because each adapter has many regex / suffix / prefix branches
        // that are individually covered but with low aggregate density;
        // the shogi-coord helper has bounds-check branches the happy-path
        // tests don't exercise; and `lasca.ts`/`bashni.ts` are pure
        // re-export shims (0% coverage by design — the logic lives in
        // `stackingPdn.ts` which is exercised directly).
        'src/cogitate/notation/tier2/**': { lines: 85, branches: 60 },
      },
    },
  },
});
