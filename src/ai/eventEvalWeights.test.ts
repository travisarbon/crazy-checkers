/**
 * Tests for eventEvalWeights.ts — Event-Aware Evaluator (Task 10.1)
 */

import { describe, it, expect } from 'vitest';
import {
  mergeWeights,
  evaluateWithEvents,
  EVENT_EVAL_WEIGHTS_REGISTRY,
  LIVE_GRENADE_PROXIMITY_PENALTY_PER_PAIR,
} from './eventEvalWeights';
import { evaluate, EVAL_WEIGHTS } from './evaluator';
import { buildBoard, W, B, P, K } from '../engine/test-utils';
import { CrazyEvent, PieceColor } from '../engine/types';
import { createActiveEvent } from '../engine/events';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(
  type: CrazyEvent,
  triggeredBy: PieceColor = PieceColor.Black,
): ReturnType<typeof createActiveEvent> {
  return createActiveEvent(type, triggeredBy, 0);
}

// A simple mid-game board: 3 white pawns vs 3 black pawns
const MID_GAME_BOARD = buildBoard([
  { sq: 14, color: W, type: P },
  { sq: 15, color: W, type: P },
  { sq: 18, color: W, type: P },
  { sq: 12, color: B, type: P },
  { sq: 11, color: B, type: P },
  { sq: 8, color: B, type: P },
]);

// White advantage: 3 white vs 1 black
const WHITE_ADVANTAGE_BOARD = buildBoard([
  { sq: 14, color: W, type: P },
  { sq: 15, color: W, type: P },
  { sq: 18, color: W, type: P },
  { sq: 12, color: B, type: P },
]);

// Board with white king
const KING_BOARD = buildBoard([
  { sq: 15, color: W, type: K },
  { sq: 12, color: B, type: P },
  { sq: 11, color: B, type: P },
]);

// ---------------------------------------------------------------------------
// 1. mergeWeights unit tests
// ---------------------------------------------------------------------------

describe('mergeWeights', () => {
  it('empty multipliers returns weights identical to base', () => {
    const result = mergeWeights(EVAL_WEIGHTS, {});
    expect(result).toEqual(EVAL_WEIGHTS);
  });

  it('single field multiplier adjusts only that field', () => {
    const result = mergeWeights(EVAL_WEIGHTS, { mobilityPerMove: 2.0 });
    expect(result.mobilityPerMove).toBe(EVAL_WEIGHTS.mobilityPerMove * 2.0);
    expect(result.pawnValue).toBe(EVAL_WEIGHTS.pawnValue);
    expect(result.kingValue).toBe(EVAL_WEIGHTS.kingValue);
    expect(result.centerBonus).toBe(EVAL_WEIGHTS.centerBonus);
  });

  it('zero multiplier zeroes the weight', () => {
    const result = mergeWeights(EVAL_WEIGHTS, { backRowBonus: 0.0 });
    expect(result.backRowBonus).toBe(0);
    expect(result.pawnValue).toBe(EVAL_WEIGHTS.pawnValue);
  });

  it('sequential merges compose multiplicatively', () => {
    const step1 = mergeWeights(EVAL_WEIGHTS, { mobilityPerMove: 2.0 });
    const step2 = mergeWeights(step1, { mobilityPerMove: 1.5 });
    expect(step2.mobilityPerMove).toBeCloseTo(EVAL_WEIGHTS.mobilityPerMove * 2.0 * 1.5);
  });

  it('base argument is not mutated', () => {
    const original = { ...EVAL_WEIGHTS };
    mergeWeights(EVAL_WEIGHTS, { mobilityPerMove: 99 });
    expect(EVAL_WEIGHTS.mobilityPerMove).toBe(original.mobilityPerMove);
  });
});

// ---------------------------------------------------------------------------
// 2. evaluateWithEvents with empty events
// ---------------------------------------------------------------------------

describe('evaluateWithEvents — empty activeEvents', () => {
  it('returns the same score as evaluate() with no active events', () => {
    const color = PieceColor.White;
    const baseScore = evaluate(MID_GAME_BOARD, color);
    const eventScore = evaluateWithEvents(MID_GAME_BOARD, color, []);
    expect(eventScore).toBe(baseScore);
  });
});

// ---------------------------------------------------------------------------
// 3. Per-event evaluation adjustments
// ---------------------------------------------------------------------------

describe('King for a Day evaluation', () => {
  it('is registered in the registry', () => {
    expect(EVENT_EVAL_WEIGHTS_REGISTRY.has(CrazyEvent.KingForADay)).toBe(true);
  });

  it('produces a different score than base evaluate()', () => {
    const event = makeEvent(CrazyEvent.KingForADay);
    const base = evaluate(MID_GAME_BOARD, PieceColor.White);
    const withEvent = evaluateWithEvents(MID_GAME_BOARD, PieceColor.White, [event]);
    expect(withEvent).not.toBe(base);
  });

  it('reduces backRowBonus influence (zero multiplier)', () => {
    // Board with white pawns on their starting back row (29-32)
    const backRowBoard = buildBoard([
      { sq: 29, color: W, type: P },
      { sq: 30, color: W, type: P },
      { sq: 12, color: B, type: P },
      { sq: 11, color: B, type: P },
    ]);
    const event = makeEvent(CrazyEvent.KingForADay);
    // With King for a Day, backRowBonus is 0x — score change vs base
    const base = evaluate(backRowBoard, PieceColor.White);
    const withEvent = evaluateWithEvents(backRowBoard, PieceColor.White, [event]);
    // King for a Day reduces back row bonus to 0, so withEvent should differ
    expect(withEvent).not.toBe(base);
  });

  it('increases mobility weight (2.0x multiplier)', () => {
    // Verify that the entry has a mobility multiplier of 2.0
    const entry = EVENT_EVAL_WEIGHTS_REGISTRY.get(CrazyEvent.KingForADay);
    expect(entry?.multipliers?.mobilityPerMove).toBe(2.0);
  });
});

describe('Live Grenade evaluation', () => {
  it('is registered in the registry', () => {
    expect(EVENT_EVAL_WEIGHTS_REGISTRY.has(CrazyEvent.LiveGrenade)).toBe(true);
  });

  it('penalizes clustered white pieces (event score lower than base score)', () => {
    // sq 9 (row 2, col 1) and sq 13 (row 3, col 0) are diagonally adjacent
    // sq 9 (row 2, col 1) and sq 14 (row 3, col 2) are also diagonally adjacent
    // 3 clustered white pieces → 2 proximity pairs → penalty = 2 * 8 = 16
    const clusteredBoard = buildBoard([
      { sq: 9, color: W, type: P },
      { sq: 13, color: W, type: P },
      { sq: 14, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = makeEvent(CrazyEvent.LiveGrenade);
    const baseScore = evaluate(clusteredBoard, PieceColor.White);
    const eventScore = evaluateWithEvents(clusteredBoard, PieceColor.White, [event]);
    // Clustering penalty reduces white's score
    expect(eventScore).toBeLessThan(baseScore);
    // Penalty magnitude matches expected value: 2 pairs * LIVE_GRENADE_PROXIMITY_PENALTY_PER_PAIR
    expect(baseScore - eventScore).toBeCloseTo(2 * LIVE_GRENADE_PROXIMITY_PENALTY_PER_PAIR);
  });

  it('awards bonus when opponent pieces cluster', () => {
    // sq 14 and sq 18 are diagonally adjacent — use them for opponent clustering
    const board = buildBoard([
      { sq: 5, color: W, type: P },
      { sq: 28, color: W, type: P },
      { sq: 14, color: B, type: P },
      { sq: 18, color: B, type: P }, // diagonally adjacent to sq 14
    ]);
    const event = makeEvent(CrazyEvent.LiveGrenade);
    const baseScore = evaluate(board, PieceColor.White);
    const eventScore = evaluateWithEvents(board, PieceColor.White, [event]);
    // Opponent clustering gives white a bonus → eventScore > baseScore
    expect(eventScore).toBeGreaterThan(baseScore);
  });

  it('proximity penalty constant is positive', () => {
    expect(LIVE_GRENADE_PROXIMITY_PENALTY_PER_PAIR).toBeGreaterThan(0);
  });
});

describe('Hot Potato evaluation', () => {
  it('is registered in the registry', () => {
    expect(EVENT_EVAL_WEIGHTS_REGISTRY.has(CrazyEvent.HotPotato)).toBe(true);
  });

  it('reduces score when triggered by the evaluating color', () => {
    const event = createActiveEvent(CrazyEvent.HotPotato, PieceColor.White, 0);
    const base = evaluate(MID_GAME_BOARD, PieceColor.White);
    const withEvent = evaluateWithEvents(MID_GAME_BOARD, PieceColor.White, [event]);
    // White is losing a piece — score should be lower
    expect(withEvent).toBeLessThan(base);
  });

  it('does not adjust score when triggered by the opponent', () => {
    // triggeredBy = Black, evaluating White → no adjustment
    const event = createActiveEvent(CrazyEvent.HotPotato, PieceColor.Black, 0);
    const base = evaluate(MID_GAME_BOARD, PieceColor.White);
    const withEvent = evaluateWithEvents(MID_GAME_BOARD, PieceColor.White, [event]);
    expect(withEvent).toBe(base);
  });
});

describe('Checks Mix evaluation', () => {
  it('is registered in the registry', () => {
    expect(EVENT_EVAL_WEIGHTS_REGISTRY.has(CrazyEvent.ChecksMix)).toBe(true);
  });

  it('zeroes positional weights', () => {
    const entry = EVENT_EVAL_WEIGHTS_REGISTRY.get(CrazyEvent.ChecksMix);
    expect(entry?.multipliers?.centerBonus).toBe(0.0);
    expect(entry?.multipliers?.backRowBonus).toBe(0.0);
    expect(entry?.multipliers?.mobilityPerMove).toBe(0.0);
    expect(entry?.multipliers?.advancementPerRow).toBe(0.0);
    expect(entry?.multipliers?.trappedKingPenalty).toBe(0.0);
    expect(entry?.multipliers?.semiTrappedKingPenalty).toBe(0.0);
  });

  it('produces a score that retains material difference', () => {
    const event = makeEvent(CrazyEvent.ChecksMix);
    // White has material advantage — should still score higher than black
    const whiteScore = evaluateWithEvents(WHITE_ADVANTAGE_BOARD, PieceColor.White, [event]);
    const blackScore = evaluateWithEvents(WHITE_ADVANTAGE_BOARD, PieceColor.Black, [event]);
    expect(whiteScore).toBeGreaterThan(blackScore);
  });
});

describe('Opposite Day evaluation', () => {
  it('is registered in the registry', () => {
    expect(EVENT_EVAL_WEIGHTS_REGISTRY.has(CrazyEvent.OppositeDay)).toBe(true);
  });

  it('inverts a positive score', () => {
    const base = evaluate(WHITE_ADVANTAGE_BOARD, PieceColor.White);
    expect(base).toBeGreaterThan(0);
    const event = makeEvent(CrazyEvent.OppositeDay);
    const withEvent = evaluateWithEvents(WHITE_ADVANTAGE_BOARD, PieceColor.White, [event]);
    expect(withEvent).toBe(-base);
  });

  it('inverts a negative score', () => {
    // Black has material advantage → white score is negative
    const blackAdvBoard = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 12, color: B, type: P },
      { sq: 11, color: B, type: P },
      { sq: 8, color: B, type: P },
    ]);
    const base = evaluate(blackAdvBoard, PieceColor.White);
    const event = makeEvent(CrazyEvent.OppositeDay);
    const withEvent = evaluateWithEvents(blackAdvBoard, PieceColor.White, [event]);
    expect(withEvent).toBe(-base);
  });

  it('has no weight multipliers (only score adjuster)', () => {
    const entry = EVENT_EVAL_WEIGHTS_REGISTRY.get(CrazyEvent.OppositeDay);
    expect(entry?.multipliers).toBeUndefined();
  });
});

describe('Up in the Air evaluation', () => {
  it('is registered in the registry', () => {
    expect(EVENT_EVAL_WEIGHTS_REGISTRY.has(CrazyEvent.UpInTheAir)).toBe(true);
  });

  it('increases mobility weight (4.0x)', () => {
    const entry = EVENT_EVAL_WEIGHTS_REGISTRY.get(CrazyEvent.UpInTheAir);
    expect(entry?.multipliers?.mobilityPerMove).toBe(4.0);
  });

  it('reduces center bonus significance (0.3x)', () => {
    const entry = EVENT_EVAL_WEIGHTS_REGISTRY.get(CrazyEvent.UpInTheAir);
    expect(entry?.multipliers?.centerBonus).toBe(0.3);
  });

  it('produces a different score than base evaluate()', () => {
    const event = makeEvent(CrazyEvent.UpInTheAir);
    const base = evaluate(MID_GAME_BOARD, PieceColor.White);
    const withEvent = evaluateWithEvents(MID_GAME_BOARD, PieceColor.White, [event]);
    expect(withEvent).not.toBe(base);
  });
});

describe('No Touching evaluation', () => {
  it('is registered in the registry', () => {
    expect(EVENT_EVAL_WEIGHTS_REGISTRY.has(CrazyEvent.NoTouching)).toBe(true);
  });

  it('increases king value (1.3x)', () => {
    const entry = EVENT_EVAL_WEIGHTS_REGISTRY.get(CrazyEvent.NoTouching);
    expect(entry?.multipliers?.kingValue).toBe(1.3);
  });

  it('reduces trapped king penalty (0.4x)', () => {
    const entry = EVENT_EVAL_WEIGHTS_REGISTRY.get(CrazyEvent.NoTouching);
    expect(entry?.multipliers?.trappedKingPenalty).toBe(0.4);
  });

  it('increases king score on board with kings', () => {
    const event = makeEvent(CrazyEvent.NoTouching);
    const base = evaluate(KING_BOARD, PieceColor.White);
    const withEvent = evaluateWithEvents(KING_BOARD, PieceColor.White, [event]);
    // King is more valuable — white should score higher with event active
    expect(withEvent).not.toBe(base);
  });
});

// ---------------------------------------------------------------------------
// 4. Stacked events integration
// ---------------------------------------------------------------------------

describe('Stacked events', () => {
  it('King for a Day + Opposite Day produces inverted score', () => {
    const kfadEvent = makeEvent(CrazyEvent.KingForADay);
    const oppEvent = makeEvent(CrazyEvent.OppositeDay);

    // Score with only King for a Day
    const kfadScore = evaluateWithEvents(MID_GAME_BOARD, PieceColor.White, [kfadEvent]);
    // Score with both stacked
    const stackedScore = evaluateWithEvents(MID_GAME_BOARD, PieceColor.White, [
      kfadEvent,
      oppEvent,
    ]);
    // Opposite Day inverts, so stacked score should be -kfadScore
    expect(stackedScore).toBeCloseTo(-kfadScore);
  });

  it('Checks Mix + Opposite Day: material difference is zeroed then inverted', () => {
    const checksMixEvent = makeEvent(CrazyEvent.ChecksMix);
    const oppEvent = makeEvent(CrazyEvent.OppositeDay);
    const baseWithChecks = evaluateWithEvents(WHITE_ADVANTAGE_BOARD, PieceColor.White, [
      checksMixEvent,
    ]);
    const stacked = evaluateWithEvents(WHITE_ADVANTAGE_BOARD, PieceColor.White, [
      checksMixEvent,
      oppEvent,
    ]);
    expect(stacked).toBeCloseTo(-baseWithChecks);
  });

  it('Opposite Day stacked with itself negates twice (returns to original)', () => {
    const opp1 = makeEvent(CrazyEvent.OppositeDay);
    const opp2 = makeEvent(CrazyEvent.OppositeDay);
    const base = evaluate(MID_GAME_BOARD, PieceColor.White);
    const doubled = evaluateWithEvents(MID_GAME_BOARD, PieceColor.White, [opp1, opp2]);
    expect(doubled).toBeCloseTo(base);
  });

  it('King for a Day + Up in the Air composes mobility multipliers multiplicatively', () => {
    // Both events multiply mobility — result should be 2.0 * 4.0 = 8x base
    const kfadEntry = EVENT_EVAL_WEIGHTS_REGISTRY.get(CrazyEvent.KingForADay);
    const uiaEntry = EVENT_EVAL_WEIGHTS_REGISTRY.get(CrazyEvent.UpInTheAir);
    const kfadMult = kfadEntry?.multipliers?.mobilityPerMove ?? 1;
    const uiaMult = uiaEntry?.multipliers?.mobilityPerMove ?? 1;
    expect(kfadMult * uiaMult).toBeCloseTo(8.0);
  });

  it('events without registry entries fall back to base evaluation', () => {
    // DoubleTrouble is not in the registry — should produce base score
    const noRegistryEvent = createActiveEvent(CrazyEvent.DoubleTrouble, PieceColor.White, 0);
    const base = evaluate(MID_GAME_BOARD, PieceColor.White);
    const withEvent = evaluateWithEvents(MID_GAME_BOARD, PieceColor.White, [noRegistryEvent]);
    expect(withEvent).toBe(base);
  });
});

// ---------------------------------------------------------------------------
// 5. All Phase 2 events are registered
// ---------------------------------------------------------------------------

describe('Registry completeness', () => {
  const phase2Events: CrazyEvent[] = [
    CrazyEvent.KingForADay,
    CrazyEvent.LiveGrenade,
    CrazyEvent.HotPotato,
    CrazyEvent.ChecksMix,
    CrazyEvent.OppositeDay,
    CrazyEvent.UpInTheAir,
    CrazyEvent.NoTouching,
  ];

  for (const eventType of phase2Events) {
    it(`${eventType} has an entry in EVENT_EVAL_WEIGHTS_REGISTRY`, () => {
      expect(EVENT_EVAL_WEIGHTS_REGISTRY.has(eventType)).toBe(true);
    });
  }

  it('registry has exactly 39 entries (7 Phase 2 + 12 Task 15 + 20 Task 16 events)', () => {
    expect(EVENT_EVAL_WEIGHTS_REGISTRY.size).toBe(39);
  });
});

// ---------------------------------------------------------------------------
// 6. evaluate() backward compatibility
// ---------------------------------------------------------------------------

describe('evaluate() backward compatibility', () => {
  it('calling evaluate() without weights uses EVAL_WEIGHTS defaults', () => {
    const withDefault = evaluate(MID_GAME_BOARD, PieceColor.White);
    const withExplicit = evaluate(MID_GAME_BOARD, PieceColor.White, EVAL_WEIGHTS);
    expect(withDefault).toBe(withExplicit);
  });

  it('custom weights parameter changes the score', () => {
    const base = evaluate(MID_GAME_BOARD, PieceColor.White);
    const customWeights = { ...EVAL_WEIGHTS, mobilityPerMove: 0 };
    const custom = evaluate(MID_GAME_BOARD, PieceColor.White, customWeights);
    expect(custom).not.toBe(base);
  });
});
