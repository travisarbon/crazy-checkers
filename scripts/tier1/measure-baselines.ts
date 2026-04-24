#!/usr/bin/env tsx
/**
 * Task 28.7 — Tier 1 performance baseline measurement.
 *
 * For every Tier 1 gameId, measures:
 *   - starting-position construction time (mean over N runs).
 *   - `getLegalMoves(startingPosition)` time (mean over N runs).
 *   - serializer toJSON + fromJSON round-trip time on the starting position
 *     (mean over N runs).
 *
 * Emits a JSON report to `.tmp/tier1-baselines.json` which the tier gate
 * consumes when populating the `## Tier 1 — Standard Draughts Variants`
 * section of `Documentation/Phase 4/Phase_4_Performance_Baselines.md`.
 *
 * Measurements are wall-clock milliseconds via `performance.now()`; the
 * absolute numbers depend on hardware, so the report also records the
 * Node version and platform for reproducibility.
 */

import { performance } from 'node:perf_hooks';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostname, platform, release, arch, cpus, totalmem } from 'node:os';
import { registerTier1, TIER_1_GAME_IDS } from '../../src/engine/classified/tier1';
import { getClassifiedGame } from '../../src/engine/classified/registry';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(REPO_ROOT, '.tmp');
const OUT_FILE = join(OUT_DIR, 'tier1-baselines.json');

const SAMPLES_PER_MEASUREMENT = 100;

interface Measurement {
  readonly meanMs: number;
  readonly p95Ms: number;
  readonly medianMs: number;
  readonly samples: number;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx] ?? 0;
}

function measure(label: string, fn: () => void): Measurement {
  // warm-up
  for (let i = 0; i < 10; i += 1) fn();

  const samples: number[] = [];
  for (let i = 0; i < SAMPLES_PER_MEASUREMENT; i += 1) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  void label;
  return {
    meanMs: samples.reduce((s, v) => s + v, 0) / samples.length,
    medianMs: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    samples: samples.length,
  };
}

async function main(): Promise<void> {
  registerTier1({ replace: true } as never);

  const perGame: Record<
    string,
    {
      readonly startingPosition: Measurement;
      readonly getLegalMovesStart: Measurement;
      readonly serializerRoundTrip: Measurement;
      readonly legalMovesAtStart: number;
    }
  > = {};

  for (const gameId of TIER_1_GAME_IDS) {
    const spec = getClassifiedGame(gameId);
    if (!spec) throw new Error(`no spec for ${String(gameId)}`);
    const rs = spec.ruleSet;

    const start = measure('startingPosition', () => void rs.startingPosition());
    const initial = rs.startingPosition();
    const legal = measure('getLegalMoves', () => void rs.getLegalMoves(initial));
    const legalCount = rs.getLegalMoves(initial).length;

    const ser = rs.serializer;
    const roundTrip = measure('serializerRoundTrip', () => {
      const j = ser.toJSON(initial);
      const s = JSON.stringify(j);
      const back = ser.fromJSON(JSON.parse(s) as never);
      void ser.toJSON(back);
    });

    perGame[String(gameId)] = {
      startingPosition: start,
      getLegalMovesStart: legal,
      serializerRoundTrip: roundTrip,
      legalMovesAtStart: legalCount,
    };
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    measuredAt: new Date().toISOString(),
    samplesPerMeasurement: SAMPLES_PER_MEASUREMENT,
    host: {
      hostname: hostname(),
      platform: platform(),
      release: release(),
      arch: arch(),
      cpu: cpus()[0]?.model ?? 'unknown',
      cpuCount: cpus().length,
      totalMemGb: Math.round((totalmem() / (1024 * 1024 * 1024)) * 10) / 10,
      nodeVersion: process.version,
    },
    perGame,
  };
  writeFileSync(OUT_FILE, JSON.stringify(report, null, 2) + '\n');

  // Console summary (markdown-ready table row per game).
  console.log('Tier 1 baseline measurements (mean ms, p95 ms):');
  console.log(
    '| gameId | startingPosition mean/p95 | getLegalMoves mean/p95 | serializer round-trip mean/p95 | legalMovesAtStart |',
  );
  console.log(
    '| --- | ---:| ---:| ---:| ---:|',
  );
  for (const gameId of TIER_1_GAME_IDS) {
    const m = perGame[String(gameId)];
    if (!m) continue;
    const fmt = (x: Measurement): string =>
      `${x.meanMs.toFixed(3)} / ${x.p95Ms.toFixed(3)}`;
    console.log(
      `| ${String(gameId)} | ${fmt(m.startingPosition)} | ${fmt(m.getLegalMovesStart)} | ${fmt(m.serializerRoundTrip)} | ${String(m.legalMovesAtStart)} |`,
    );
  }
  console.log(`\nreport → ${OUT_FILE}`);
}

main().catch((err) => {
  console.error('[measure-baselines] failed:', err);
  process.exit(1);
});
