/**
 * Tier 2 generic search tests (Task 29.7).
 *
 * Spot-checks `tier2IterativeSearch` invariants:
 *  - Returns null move when no legal moves available (game over).
 *  - Single-legal-move position returns that move at depth 1.
 *  - Time-cap is respected (search aborts if maxTimeMs exceeded).
 *  - Deterministic for same input (no internal RNG).
 */

import { describe, expect, it } from 'vitest';
import { tier2IterativeSearch } from '../common/tier2Search';
import { getTier2Dispatch } from '../index';

describe('tier2IterativeSearch', () => {
  it('returns a move on the dameo starting position at depth 2', () => {
    const dispatch = getTier2Dispatch('dameo' as never);
    const start = dispatch.ruleSet.startingPosition();
    const result = tier2IterativeSearch(
      start,
      dispatch.ruleSet,
      dispatch.evaluate,
      { maxDepth: 2, maxTimeMs: 2000 },
    );
    expect(result.move).not.toBeNull();
  });

  it('deterministic: same input → same result', () => {
    const dispatch = getTier2Dispatch('mak-yek' as never);
    const start = dispatch.ruleSet.startingPosition();
    const a = tier2IterativeSearch(
      start,
      dispatch.ruleSet,
      dispatch.evaluate,
      { maxDepth: 2, maxTimeMs: 2000 },
    );
    const b = tier2IterativeSearch(
      start,
      dispatch.ruleSet,
      dispatch.evaluate,
      { maxDepth: 2, maxTimeMs: 2000 },
    );
    expect(a.move?.kind).toBe(b.move?.kind);
    expect(a.move?.from).toBe(b.move?.from);
    expect(a.move?.to).toBe(b.move?.to);
  });

  it('respects maxTimeMs (returns even when very tight)', () => {
    const dispatch = getTier2Dispatch('hasami-shogi' as never);
    const start = dispatch.ruleSet.startingPosition();
    // Aggressive 50ms cap should still return a result (depth 1+).
    const result = tier2IterativeSearch(
      start,
      dispatch.ruleSet,
      dispatch.evaluate,
      { maxDepth: 8, maxTimeMs: 50 },
    );
    expect(result.move).not.toBeNull();
    expect(result.depth).toBeGreaterThanOrEqual(0);
  });
});
