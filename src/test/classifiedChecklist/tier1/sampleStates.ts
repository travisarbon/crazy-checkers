/**
 * Task 28.7 — per-game sample-state provider for the Tier 1 checklist runner.
 *
 * Produces a small representative set of `ClassifiedGameState`s for a given
 * Tier 1 gameId by stepping the rule set through a seeded-random self-play.
 * The resulting states are handed to `assertGameSerializerRoundTrip` so the
 * C-05 round-trip assertion exercises more than just the starting position.
 *
 * The sampling strategy is deterministic (fixed LCG seed per game) so test
 * failures are reproducible from the name of the game alone.
 */

import type { ClassifiedGameId } from '../../../engine/classified/ClassifiedRuleSet';
import { getClassifiedGame } from '../../../engine/classified/registry';

interface SamplingOptions {
  /** Fixed LCG seed so sample states are reproducible across CI runs. */
  readonly seed: number;
  /** Upper bound on self-play plies used to collect samples. */
  readonly moveLimit: number;
  /**
   * Plies at which to snapshot the state. Must be sorted ascending.
   * Any ply past the terminal state is silently ignored so the sample
   * set for short games still contains the starting position + terminal.
   */
  readonly snapshotPlies: readonly number[];
}

const DEFAULT_OPTIONS: SamplingOptions = {
  seed: 0xBEEF_F00D,
  moveLimit: 400,
  snapshotPlies: [0, 1, 10, 40, 100],
};

function makeLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/**
 * Returns an ordered list of representative states for `gameId`:
 *  - index 0 is always the starting position;
 *  - subsequent entries are the state immediately after each requested
 *    `snapshotPlies` value, terminating early if the game ends.
 *
 * Duplicates (e.g., when the terminal ply collides with a snapshot target)
 * are preserved — the consumer iterates each sample and round-trips it.
 */
export function sampleStatesFor(
  gameId: ClassifiedGameId,
  options: Partial<SamplingOptions> = {},
): readonly unknown[] {
  const opts: SamplingOptions = { ...DEFAULT_OPTIONS, ...options };
  const spec = getClassifiedGame(gameId);
  if (!spec) {
    throw new Error(`sampleStatesFor: no registration for gameId "${String(gameId)}"`);
  }

  const ruleSet = spec.ruleSet;
  const rng = makeLcg(opts.seed);
  const samples: unknown[] = [];
  const snapshotAt = new Set(opts.snapshotPlies);

  let state = ruleSet.startingPosition();
  samples.push(state); // ply 0 snapshot (starting position)

  for (let ply = 1; ply <= opts.moveLimit; ply += 1) {
    const terminal = ruleSet.checkGameOver(state);
    if (terminal !== null) {
      // Terminal state snapshot (deduplicate against the last pushed sample).
      if (samples[samples.length - 1] !== state) samples.push(state);
      break;
    }
    const moves = ruleSet.getLegalMoves(state);
    if (moves.length === 0) break;
    const pick = moves[Math.floor(rng() * moves.length)];
    if (!pick) break;
    state = ruleSet.applyMove(state, pick);
    if (snapshotAt.has(ply)) samples.push(state);
  }

  return samples;
}
