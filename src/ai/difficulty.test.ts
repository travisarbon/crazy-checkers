import { describe, it, expect } from 'vitest';
import {
  EASY_CONFIG,
  HARD_CONFIG,
  getDifficultyConfig,
  toSearchConfig,
  selectMove,
  type DifficultyConfig,
  type Difficulty,
} from './difficulty';
import type { SearchResult } from './search';
import type { Move } from '../engine/types';
import { square } from '../engine/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal Move for testing. */
function makeMove(from: number, to: number): Move {
  return {
    from: square(from),
    path: [square(to)],
    captured: [],
  };
}

/** Creates a minimal SearchResult for testing. */
function makeSearchResult(
  move: Move | null,
  score: number,
  rootMoveScores: Array<{ move: Move; score: number }> = [],
): SearchResult {
  return { move, score, depth: 4, nodesEvaluated: 100, rootMoveScores };
}

/** Returns a deterministic randomFn that cycles through the provided values. */
function deterministicRandom(...values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length] as number;
    index++;
    return value;
  };
}

// Test moves
const moveA = makeMove(1, 5);
const moveB = makeMove(2, 6);
const moveC = makeMove(3, 7);

// ---------------------------------------------------------------------------
// Preset configurations
// ---------------------------------------------------------------------------

describe('preset configurations', () => {
  it('EASY_CONFIG has difficulty "easy"', () => {
    expect(EASY_CONFIG.difficulty).toBe('easy');
  });

  it('EASY_CONFIG has the correct search parameters', () => {
    expect(EASY_CONFIG.maxDepth).toBe(4);
    expect(EASY_CONFIG.timeLimitMs).toBe(5000);
    expect(EASY_CONFIG.quiescenceEnabled).toBe(false);
    expect(EASY_CONFIG.quiescenceMaxDepth).toBe(0);
  });

  it('EASY_CONFIG has the correct move selection parameters', () => {
    expect(EASY_CONFIG.blunderRate).toBe(0.12);
    expect(EASY_CONFIG.moveRandomization).toBe(0.9);
  });

  it('HARD_CONFIG has difficulty "hard"', () => {
    expect(HARD_CONFIG.difficulty).toBe('hard');
  });

  it('HARD_CONFIG has the correct search parameters', () => {
    expect(HARD_CONFIG.maxDepth).toBe(10);
    expect(HARD_CONFIG.timeLimitMs).toBe(2000);
    expect(HARD_CONFIG.quiescenceEnabled).toBe(true);
    expect(HARD_CONFIG.quiescenceMaxDepth).toBe(4);
  });

  it('HARD_CONFIG has the correct move selection parameters', () => {
    expect(HARD_CONFIG.blunderRate).toBe(0);
    expect(HARD_CONFIG.moveRandomization).toBe(1.0);
  });

  it('Easy search depth is within design document range (3-4)', () => {
    expect(EASY_CONFIG.maxDepth).toBeGreaterThanOrEqual(3);
    expect(EASY_CONFIG.maxDepth).toBeLessThanOrEqual(4);
  });

  it('Hard search depth is within design document range (8-10)', () => {
    expect(HARD_CONFIG.maxDepth).toBeGreaterThanOrEqual(8);
    expect(HARD_CONFIG.maxDepth).toBeLessThanOrEqual(10);
  });

  it('Easy blunder rate is within design document range (10-15%)', () => {
    expect(EASY_CONFIG.blunderRate).toBeGreaterThanOrEqual(0.1);
    expect(EASY_CONFIG.blunderRate).toBeLessThanOrEqual(0.15);
  });
});

// ---------------------------------------------------------------------------
// getDifficultyConfig
// ---------------------------------------------------------------------------

describe('getDifficultyConfig', () => {
  it('returns EASY_CONFIG for "easy"', () => {
    expect(getDifficultyConfig('easy')).toBe(EASY_CONFIG);
  });

  it('returns HARD_CONFIG for "hard"', () => {
    expect(getDifficultyConfig('hard')).toBe(HARD_CONFIG);
  });

  it('throws for an unknown difficulty string', () => {
    expect(() => getDifficultyConfig('medium' as Difficulty)).toThrow('Unknown difficulty');
  });
});

// ---------------------------------------------------------------------------
// toSearchConfig
// ---------------------------------------------------------------------------

describe('toSearchConfig', () => {
  it('extracts only the search-relevant fields from EASY_CONFIG', () => {
    const sc = toSearchConfig(EASY_CONFIG);
    expect(sc.maxDepth).toBe(4);
    expect(sc.timeLimitMs).toBe(5000);
    expect(sc.quiescenceEnabled).toBe(false);
    expect(sc.quiescenceMaxDepth).toBe(0);
    expect('blunderRate' in sc).toBe(false);
    expect('moveRandomization' in sc).toBe(false);
    expect('difficulty' in sc).toBe(false);
  });

  it('extracts only the search-relevant fields from HARD_CONFIG', () => {
    const sc = toSearchConfig(HARD_CONFIG);
    expect(sc.maxDepth).toBe(10);
    expect(sc.timeLimitMs).toBe(2000);
    expect(sc.quiescenceEnabled).toBe(true);
    expect(sc.quiescenceMaxDepth).toBe(4);
    expect('blunderRate' in sc).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// selectMove — trivial cases
// ---------------------------------------------------------------------------

describe('selectMove — trivial cases', () => {
  it('returns the only legal move when there is exactly one', () => {
    const result = selectMove(makeSearchResult(moveA, 100), [], [moveA], EASY_CONFIG);
    expect(result).toBe(moveA);
  });

  it('returns the search best move with HARD_CONFIG (no blunder, no randomization)', () => {
    const rootScores = [
      { move: moveA, score: 50 },
      { move: moveB, score: 100 },
      { move: moveC, score: 80 },
    ];
    const result = selectMove(
      makeSearchResult(moveB, 100, rootScores),
      rootScores,
      [moveA, moveB, moveC],
      HARD_CONFIG,
    );
    expect(result).toBe(moveB);
  });
});

// ---------------------------------------------------------------------------
// selectMove — blunder injection
// ---------------------------------------------------------------------------

describe('selectMove — blunder injection', () => {
  const rootScores = [
    { move: moveA, score: 100 },
    { move: moveB, score: 80 },
    { move: moveC, score: 50 },
  ];
  const moves = [moveA, moveB, moveC];

  it('plays a random legal move when the blunder roll succeeds', () => {
    // 0.05 < 0.12 blunderRate => blunder triggers
    // 0.66 => Math.floor(0.66 * 3) = 1 => moveB
    const result = selectMove(
      makeSearchResult(moveA, 100, rootScores),
      rootScores,
      moves,
      EASY_CONFIG,
      deterministicRandom(0.05, 0.66),
    );
    expect(result).toBe(moveB);
  });

  it('does NOT blunder when the roll exceeds the blunderRate', () => {
    // 0.50 >= 0.12 => no blunder, falls through to score-window
    const result = selectMove(
      makeSearchResult(moveA, 100, rootScores),
      rootScores,
      moves,
      EASY_CONFIG,
      deterministicRandom(0.5, 0.0),
    );
    // Should be from the score window, not a random blunder pick.
    // With score window 0.9, threshold = 90, candidates are moveA(100) and moveB(80 < 90 excluded)
    // Wait: moveA(100) >= 90 yes, moveB(80) < 90 no, moveC(50) < 90 no
    // So only candidate is moveA, randomFn 0.0 => index 0 => moveA
    expect(result).toBe(moveA);
  });

  it('never blunders with HARD_CONFIG (blunderRate === 0)', () => {
    for (let i = 0; i < 100; i++) {
      const result = selectMove(
        makeSearchResult(moveA, 100, rootScores),
        rootScores,
        moves,
        HARD_CONFIG,
      );
      expect(result).toBe(moveA);
    }
  });

  it('blunder can select any legal move, including the worst one', () => {
    // 0.01 < 0.12 => blunder triggers
    // 0.99 => Math.floor(0.99 * 3) = 2 => moveC (worst)
    const result = selectMove(
      makeSearchResult(moveA, 100, rootScores),
      rootScores,
      moves,
      EASY_CONFIG,
      deterministicRandom(0.01, 0.99),
    );
    expect(result).toBe(moveC);
  });

  it('blunder selects uniformly among all legal moves', () => {
    const selected = new Set<Move>();
    // Each iteration: first value triggers blunder, second picks index
    // 0.0 => index 0 (moveA), 0.33 => index 0 (moveA), 0.5 => index 1 (moveB), 0.9 => index 2 (moveC)
    const picks = [0.0, 0.34, 0.67];
    for (const pick of picks) {
      const result = selectMove(
        makeSearchResult(moveA, 100, rootScores),
        rootScores,
        moves,
        EASY_CONFIG,
        deterministicRandom(0.01, pick),
      );
      selected.add(result);
    }
    expect(selected.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// selectMove — score-window randomization
// ---------------------------------------------------------------------------

describe('selectMove — score-window randomization', () => {
  it('selects among moves within the 90% window', () => {
    const rootScores = [
      { move: moveA, score: 100 },
      { move: moveB, score: 95 }, // >= 90 threshold
      { move: moveC, score: 50 }, // below threshold
    ];
    // No blunder (0.50 >= 0.12), then pick index 1 of candidates [A, B]
    const result = selectMove(
      makeSearchResult(moveA, 100, rootScores),
      rootScores,
      [moveA, moveB, moveC],
      EASY_CONFIG,
      deterministicRandom(0.5, 0.5),
    );
    expect(result).toBe(moveB);
  });

  it('excludes moves below the threshold', () => {
    const rootScores = [
      { move: moveA, score: 100 },
      { move: moveB, score: 95 },
      { move: moveC, score: 50 },
    ];
    // Run multiple times — moveC should never be selected via randomization
    const selected = new Set<Move>();
    const picks = [0.0, 0.5, 0.99];
    for (const pick of picks) {
      const result = selectMove(
        makeSearchResult(moveA, 100, rootScores),
        rootScores,
        [moveA, moveB, moveC],
        EASY_CONFIG,
        deterministicRandom(0.5, pick),
      );
      selected.add(result);
    }
    expect(selected.has(moveC)).toBe(false);
  });

  it('includes all moves when all scores are within the window', () => {
    const rootScores = [
      { move: moveA, score: 100 },
      { move: moveB, score: 98 },
      { move: moveC, score: 92 },
    ];
    // All >= 90, so all three are candidates
    const selected = new Set<Move>();
    const picks = [0.0, 0.34, 0.67];
    for (const pick of picks) {
      const result = selectMove(
        makeSearchResult(moveA, 100, rootScores),
        rootScores,
        [moveA, moveB, moveC],
        EASY_CONFIG,
        deterministicRandom(0.5, pick),
      );
      selected.add(result);
    }
    expect(selected.size).toBe(3);
  });

  it('handles negative scores correctly', () => {
    const rootScores = [
      { move: moveA, score: -50 }, // best (least bad)
      { move: moveB, score: -55 }, // threshold = -50 - 5 = -55, so -55 >= -55 => included
      { move: moveC, score: -100 }, // below threshold
    ];
    // No blunder, pick index 1 of candidates [A, B]
    const result = selectMove(
      makeSearchResult(moveA, -50, rootScores),
      rootScores,
      [moveA, moveB, moveC],
      EASY_CONFIG,
      deterministicRandom(0.5, 0.5),
    );
    expect(result).toBe(moveB);

    // moveC should not be selectable via randomization
    const result2 = selectMove(
      makeSearchResult(moveA, -50, rootScores),
      rootScores,
      [moveA, moveB, moveC],
      EASY_CONFIG,
      deterministicRandom(0.5, 0.99),
    );
    expect(result2).not.toBe(moveC);
  });

  it('handles zero best score correctly', () => {
    const rootScores = [
      { move: moveA, score: 0 },
      { move: moveB, score: 0 },
      { move: moveC, score: -10 },
    ];
    // threshold = 0 - 0 = 0. Only moveA and moveB are candidates.
    const result = selectMove(
      makeSearchResult(moveA, 0, rootScores),
      rootScores,
      [moveA, moveB, moveC],
      EASY_CONFIG,
      deterministicRandom(0.5, 0.5),
    );
    expect(result).toBe(moveB);
  });

  it('handles a single root move score', () => {
    const rootScores = [{ move: moveA, score: 100 }];
    const result = selectMove(
      makeSearchResult(moveA, 100, rootScores),
      rootScores,
      [moveA],
      EASY_CONFIG,
      deterministicRandom(0.5, 0.0),
    );
    expect(result).toBe(moveA);
  });

  it('falls back to search best move when allMoveScores is empty', () => {
    const result = selectMove(
      makeSearchResult(moveA, 100),
      [],
      [moveA, moveB, moveC],
      EASY_CONFIG,
      deterministicRandom(0.5, 0.0),
    );
    expect(result).toBe(moveA);
  });
});

// ---------------------------------------------------------------------------
// selectMove — edge cases
// ---------------------------------------------------------------------------

describe('selectMove — edge cases', () => {
  it('handles searchResult.move being null (terminal position fallback)', () => {
    const result = selectMove(makeSearchResult(null, -10000), [], [moveA], EASY_CONFIG);
    expect(result).toBe(moveA);
  });

  it('blunder rate of exactly 0 never triggers blunders', () => {
    const config: DifficultyConfig = { ...EASY_CONFIG, blunderRate: 0 };
    const rootScores = [
      { move: moveA, score: 100 },
      { move: moveB, score: 80 },
    ];
    // randomFn returns 0.0 — but 0.0 < 0 is false, so no blunder
    const result = selectMove(
      makeSearchResult(moveA, 100, rootScores),
      rootScores,
      [moveA, moveB],
      config,
      deterministicRandom(0.0, 0.0),
    );
    // Should go to score-window randomization, not blunder
    expect(result).toBe(moveA);
  });

  it('blunder rate of exactly 1.0 always triggers blunders', () => {
    const config: DifficultyConfig = { ...EASY_CONFIG, blunderRate: 1.0 };
    const rootScores = [
      { move: moveA, score: 100 },
      { move: moveB, score: 80 },
    ];
    // randomFn returns 0.999 (< 1.0) => blunder triggers
    // Second call 0.5 => Math.floor(0.5 * 2) = 1 => moveB
    const result = selectMove(
      makeSearchResult(moveA, 100, rootScores),
      rootScores,
      [moveA, moveB],
      config,
      deterministicRandom(0.999, 0.5),
    );
    expect(result).toBe(moveB);
  });

  it('falls back to first legal move when search move is null and scores empty', () => {
    const result = selectMove(
      makeSearchResult(null, -10000),
      [],
      [moveA, moveB],
      { ...HARD_CONFIG },
      deterministicRandom(0.5),
    );
    expect(result).toBe(moveA);
  });
});
