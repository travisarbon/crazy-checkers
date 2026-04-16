/**
 * repetition — tracker updates, draw predicates, and hash determinism.
 *
 * Post Task 28.2.1 §4: `kingMoveStreak` is a per-king array of
 * `[nodeId, count]` tuples. Non-capture king moves transfer the counter
 * from source to destination, incremented by 1. Captures clear all
 * entries. A king with count ≥ limit is ineligible to move *unless* the
 * owner has only kings remaining (waiver).
 */

import { describe, expect, it } from 'vitest';
import { asNodeId } from '../../boardGeometry';
import {
  createFrisianDraughtsConfig,
  createRussianDraughtsConfig,
} from './DraughtsConfig';
import {
  getKingStreak,
  getMovesSinceCapture,
  getPositionHistory,
  hasQuietGameDraw,
  hasThreefoldRepetition,
  hashPosition,
  isKingIneligible,
  POSITION_HISTORY_WINDOW,
  QUIET_GAME_PLY_LIMIT,
  streakOf,
  updateTracker,
} from './repetition';
import { makeState } from './testHelpers';
import type { DraughtsMove } from './moveGen';

function simpleMove(
  owner: 'white' | 'black',
  piece: 'man' | 'king',
): DraughtsMove {
  return {
    kind: 'simple',
    from: 'a',
    to: 'b',
    piece,
    capture: [],
    meta: { owner },
  };
}

function jumpMove(
  owner: 'white' | 'black',
  piece: 'man' | 'king',
): DraughtsMove {
  return {
    kind: 'jump',
    from: 'a',
    to: 'b',
    piece,
    capture: ['x'],
    meta: { owner },
  };
}

describe('hashPosition — determinism', () => {
  const config = createRussianDraughtsConfig();
  it('same state yields same hash', () => {
    const state = makeState(config, [
      { row: 5, col: 2, owner: 'white', kind: 'man' },
    ]);
    expect(hashPosition(state)).toBe(hashPosition(state));
  });
  it('different piece sets yield different hashes', () => {
    const a = makeState(config, [{ row: 5, col: 2, owner: 'white', kind: 'man' }]);
    const b = makeState(config, [{ row: 4, col: 1, owner: 'white', kind: 'man' }]);
    expect(hashPosition(a)).not.toBe(hashPosition(b));
  });
});

describe('updateTracker — per-king streak (Task 28.2.1)', () => {
  const config = createRussianDraughtsConfig();

  it('man move leaves the streak map unchanged', () => {
    const state = makeState(config, []);
    const seeded = {
      ...state,
      meta: { kingMoveStreak: [[10, 2]] },
    };
    const next = updateTracker(seeded, state, simpleMove('white', 'man'), {
      fromNodeId: asNodeId(0),
      toNodeId: asNodeId(1),
    });
    const out = [...getKingStreak(next)];
    expect(out).toEqual([[10, 2]]);
  });

  it('king non-capture transfers counter from source to destination +1', () => {
    const state = makeState(config, []);
    const seeded = {
      ...state,
      meta: { kingMoveStreak: [[10, 1]] },
    };
    const next = updateTracker(seeded, state, simpleMove('white', 'king'), {
      fromNodeId: asNodeId(10),
      toNodeId: asNodeId(20),
    });
    expect(streakOf(next, asNodeId(10))).toBe(0);
    expect(streakOf(next, asNodeId(20))).toBe(2);
  });

  it('any capture clears every entry', () => {
    const state = makeState(config, []);
    const seeded = {
      ...state,
      meta: { kingMoveStreak: [[5, 2], [15, 3]] },
    };
    const next = updateTracker(seeded, state, jumpMove('white', 'king'), {
      fromNodeId: asNodeId(5),
      toNodeId: asNodeId(25),
    });
    expect([...getKingStreak(next)]).toEqual([]);
  });

  it('a fresh king (no prior entry) starts at count 1 after its first non-capture move', () => {
    const state = makeState(config, []);
    const seeded = {
      ...state,
      meta: { kingMoveStreak: [] },
    };
    const next = updateTracker(seeded, state, simpleMove('white', 'king'), {
      fromNodeId: asNodeId(12),
      toNodeId: asNodeId(22),
    });
    expect(streakOf(next, asNodeId(22))).toBe(1);
  });
});

describe('updateTracker — movesSinceCapture', () => {
  const config = createRussianDraughtsConfig();
  it('increments on simple move', () => {
    const state = makeState(config, []);
    const seeded = { ...state, meta: { movesSinceCapture: 5 } };
    const next = updateTracker(seeded, state, simpleMove('white', 'man'), {
      fromNodeId: asNodeId(0),
      toNodeId: asNodeId(1),
    });
    expect(getMovesSinceCapture(next)).toBe(6);
  });
  it('resets on jump', () => {
    const state = makeState(config, []);
    const seeded = { ...state, meta: { movesSinceCapture: 20 } };
    const next = updateTracker(seeded, state, jumpMove('white', 'man'), {
      fromNodeId: asNodeId(0),
      toNodeId: asNodeId(1),
    });
    expect(getMovesSinceCapture(next)).toBe(0);
  });
});

describe('updateTracker — positionHistoryHash window', () => {
  const config = createRussianDraughtsConfig();
  it('caps history at POSITION_HISTORY_WINDOW', () => {
    const state = makeState(config, []);
    const longHistory = Array.from(
      { length: POSITION_HISTORY_WINDOW + 5 },
      (_, i) => `h${String(i)}`,
    );
    const seeded = { ...state, meta: { positionHistoryHash: longHistory } };
    const next = updateTracker(seeded, state, simpleMove('white', 'man'), {
      fromNodeId: asNodeId(0),
      toNodeId: asNodeId(1),
    });
    expect(getPositionHistory(next).length).toBe(POSITION_HISTORY_WINDOW);
  });
});

describe('isKingIneligible — Frisian per-king 3-move rule', () => {
  const config = createFrisianDraughtsConfig();

  it('fires when a king has streak ≥ 3 and the owner still has non-king pieces', () => {
    const state = {
      ...makeState(
        config,
        [
          { row: 5, col: 2, owner: 'white', kind: 'king' },
          { row: 6, col: 1, owner: 'white', kind: 'man' },
        ],
        'white',
      ),
      meta: { kingMoveStreak: [[5 * 10 + 2, 3]] },
    };
    expect(isKingIneligible(state, config, asNodeId(5 * 10 + 2))).toBe(true);
  });

  it('is waived when the owner has only kings remaining', () => {
    const state = {
      ...makeState(
        config,
        [{ row: 5, col: 2, owner: 'white', kind: 'king' }],
        'white',
      ),
      meta: { kingMoveStreak: [[5 * 10 + 2, 3]] },
    };
    expect(isKingIneligible(state, config, asNodeId(5 * 10 + 2))).toBe(false);
  });

  it('never fires on configs without kingConsecutiveMoveLimit', () => {
    const russian = createRussianDraughtsConfig();
    const state = {
      ...makeState(russian, [], 'white'),
      meta: { kingMoveStreak: [[0, 100]] },
    };
    expect(isKingIneligible(state, russian, asNodeId(0))).toBe(false);
  });
});

describe('hasThreefoldRepetition', () => {
  it('fires when the most-recent hash appears 3 times', () => {
    const state = makeState(createRussianDraughtsConfig(), []);
    const withHistory = {
      ...state,
      meta: { positionHistoryHash: ['h1', 'h2', 'h1', 'h3', 'h1'] },
    };
    expect(hasThreefoldRepetition(withHistory)).toBe(true);
  });
  it('does not fire below 3 occurrences', () => {
    const state = makeState(createRussianDraughtsConfig(), []);
    const withHistory = {
      ...state,
      meta: { positionHistoryHash: ['h1', 'h2', 'h1'] },
    };
    expect(hasThreefoldRepetition(withHistory)).toBe(false);
  });
});

describe('hasQuietGameDraw', () => {
  it('fires at or above the 80-ply limit', () => {
    const state = makeState(createRussianDraughtsConfig(), []);
    const seeded = { ...state, meta: { movesSinceCapture: QUIET_GAME_PLY_LIMIT } };
    expect(hasQuietGameDraw(seeded)).toBe(true);
  });
  it('below the limit is not a draw', () => {
    const state = makeState(createRussianDraughtsConfig(), []);
    const seeded = { ...state, meta: { movesSinceCapture: QUIET_GAME_PLY_LIMIT - 1 } };
    expect(hasQuietGameDraw(seeded)).toBe(false);
  });
});
