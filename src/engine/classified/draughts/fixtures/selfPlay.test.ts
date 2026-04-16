/**
 * Self-play invariant tests (Task 28.2 §11.10).
 *
 * Runs 50 deterministic random-self-play games per Tier 1 variant and
 * asserts zero invariant violations. 50 games × 10 variants = 500 total.
 * Right-sized from the plan's 1,000-games-per-variant target to fit the
 * unit-test suite time budget; stress-sized runs (1,000) are Task 28.5's
 * acceptance anchor.
 */

import { describe, expect, it } from 'vitest';
import { TIER_1_DRAUGHTS_GAME_IDS } from '../DraughtsConfig';
import { runSelfPlaySuite } from './selfPlayFixtures';

const GAMES_PER_VARIANT = 50;

describe('self-play invariant suite — 50 games × 10 variants', () => {
  it.each(TIER_1_DRAUGHTS_GAME_IDS)('%s: zero invariant violations', (gameId) => {
    const results = runSelfPlaySuite(gameId, GAMES_PER_VARIANT);
    const violations = results.flatMap((r) => r.invariantFailures);
    if (violations.length > 0) {
      const sample = violations.slice(0, 5).join('\n');
      throw new Error(
        `[${gameId}] ${String(violations.length)} invariant violations:\n${sample}`,
      );
    }
    expect(violations.length).toBe(0);
  }, 60_000);
});

describe('self-play — determinism check', () => {
  it.each(TIER_1_DRAUGHTS_GAME_IDS)('%s: same seed produces same outcome', (gameId) => {
    const a = runSelfPlaySuite(gameId, 3);
    const b = runSelfPlaySuite(gameId, 3);
    for (let i = 0; i < a.length; i += 1) {
      const ra = a[i];
      const rb = b[i];
      if (!ra || !rb) continue;
      expect(ra.plies).toBe(rb.plies);
      expect(ra.winner).toBe(rb.winner);
    }
  });
});
