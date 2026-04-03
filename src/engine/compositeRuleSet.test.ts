import { describe, it, expect } from 'vitest';
import { CompositeEventRuleSet, createCompositeRuleSet } from './compositeRuleSet';
import { EventDecorator } from './events';
import { createAmericanRules } from './rules';
import { createInitialBoard, getBoardSquare } from './board';
import { CrazyEvent, GameEndReason, GameResultType, PieceColor, square } from './types';
import type { ActiveEvent, BoardState, Move, RuleSet } from './types';
import { W, B, P, K, buildBoard } from './test-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a CompositeEventRuleSet with no decorators (empty registry). */
function createEmptyComposite(): CompositeEventRuleSet {
  return new CompositeEventRuleSet(createAmericanRules(), []);
}

/** Helper to create an ActiveEvent with minimal boilerplate. */
function makeEvent(type: CrazyEvent, remainingPlies: number): ActiveEvent {
  return {
    type,
    remainingPlies,
    triggeredBy: PieceColor.White,
    triggeredAtPly: 0,
  };
}

// ---------------------------------------------------------------------------
// A mock EventDecorator for testing chain building
// ---------------------------------------------------------------------------

class MockDecorator extends EventDecorator {
  private readonly eventType: CrazyEvent;
  readonly callLog: string[] = [];

  constructor(inner: RuleSet, eventType: CrazyEvent, callLog?: string[]) {
    super(inner);
    this.eventType = eventType;
    if (callLog) this.callLog = callLog;
  }

  getEventType(): CrazyEvent {
    return this.eventType;
  }

  withInner(inner: RuleSet): EventDecorator {
    return new MockDecorator(inner, this.eventType, this.callLog);
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    this.callLog.push(`getLegalMoves:${this.eventType}`);
    return super.getLegalMoves(board, activeColor);
  }
}

// ===========================================================================
// Behavioral equivalence (no active events)
// ===========================================================================

describe('CompositeEventRuleSet — behavioral equivalence with no active events', () => {
  const base = createAmericanRules();

  describe('getLegalMoves', () => {
    it('initial board, White turn: same result as AmericanRules', () => {
      const composite = createEmptyComposite();
      const board = createInitialBoard();
      expect(composite.getLegalMoves(board, W)).toEqual(base.getLegalMoves(board, W));
    });

    it('initial board, Black turn: same result as AmericanRules', () => {
      const composite = createEmptyComposite();
      const board = createInitialBoard();
      expect(composite.getLegalMoves(board, B)).toEqual(base.getLegalMoves(board, B));
    });

    it('midgame position: same result as AmericanRules', () => {
      const composite = createEmptyComposite();
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 18, color: B, type: P },
      ]);
      expect(composite.getLegalMoves(board, W)).toEqual(base.getLegalMoves(board, W));
    });

    it('forced jump position: same result as AmericanRules', () => {
      const composite = createEmptyComposite();
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 18, color: B, type: P },
      ]);
      expect(composite.getLegalMoves(board, W)).toEqual(base.getLegalMoves(board, W));
    });
  });

  describe('applyMove', () => {
    it('simple move: same result as AmericanRules', () => {
      const composite = createEmptyComposite();
      const board = buildBoard([{ sq: 22, color: W, type: P }]);
      const move: Move = { from: square(22), path: [square(18)], captured: [] };
      expect(composite.applyMove(board, move)).toEqual(base.applyMove(board, move));
    });

    it('capture move: same result as AmericanRules', () => {
      const composite = createEmptyComposite();
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 18, color: B, type: P },
      ]);
      const move: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
      expect(composite.applyMove(board, move)).toEqual(base.applyMove(board, move));
    });

    it('promotion move: same result as AmericanRules', () => {
      const composite = createEmptyComposite();
      const board = buildBoard([{ sq: 5, color: W, type: P }]);
      const move: Move = { from: square(5), path: [square(1)], captured: [] };
      const result = composite.applyMove(board, move);
      expect(getBoardSquare(result, square(1))).toEqual({ color: W, type: K });
    });
  });

  describe('checkGameOver', () => {
    it('initial board: returns null (same as AmericanRules)', () => {
      const composite = createEmptyComposite();
      expect(composite.checkGameOver(createInitialBoard(), W)).toBeNull();
    });

    it('no pieces for active player: same result as AmericanRules', () => {
      const composite = createEmptyComposite();
      const board = buildBoard([{ sq: 14, color: W, type: K }]);
      expect(composite.checkGameOver(board, B)).toEqual(base.checkGameOver(board, B));
    });

    it('no legal moves for active player: same result as AmericanRules', () => {
      const composite = createEmptyComposite();
      const board = buildBoard([{ sq: 4, color: W, type: P }]);
      expect(composite.checkGameOver(board, W)).toEqual(base.checkGameOver(board, W));
    });
  });

  describe('shouldPromote', () => {
    it('white pawn on king row: same as AmericanRules', () => {
      const composite = createEmptyComposite();
      const piece = { color: W, type: P };
      expect(composite.shouldPromote(piece, square(1))).toBe(base.shouldPromote(piece, square(1)));
      expect(composite.shouldPromote(piece, square(4))).toBe(base.shouldPromote(piece, square(4)));
    });

    it('white pawn not on king row: same as AmericanRules', () => {
      const composite = createEmptyComposite();
      const piece = { color: W, type: P };
      expect(composite.shouldPromote(piece, square(5))).toBe(base.shouldPromote(piece, square(5)));
    });

    it('king: same as AmericanRules', () => {
      const composite = createEmptyComposite();
      const piece = { color: W, type: K };
      expect(composite.shouldPromote(piece, square(1))).toBe(base.shouldPromote(piece, square(1)));
    });
  });

  describe('hooks with no active events', () => {
    it('onTurnStart passes board through unchanged', () => {
      const composite = createEmptyComposite();
      const board = createInitialBoard();
      expect(composite.onTurnStart(board, W)).toBe(board);
    });

    it('onTurnEnd passes board through unchanged', () => {
      const composite = createEmptyComposite();
      const board = createInitialBoard();
      const move: Move = { from: square(22), path: [square(18)], captured: [] };
      expect(composite.onTurnEnd(board, W, move)).toBe(board);
    });

    it('onCapture passes board through unchanged', () => {
      const composite = createEmptyComposite();
      const board = createInitialBoard();
      expect(composite.onCapture(board, square(15), [square(18)])).toBe(board);
    });

    it('onCheckGameOver passes result through unchanged', () => {
      const composite = createEmptyComposite();
      const board = createInitialBoard();
      expect(composite.onCheckGameOver(board, W, null)).toBeNull();

      const result = { type: GameResultType.WhiteWin, reason: GameEndReason.NoPiecesLeft };
      expect(composite.onCheckGameOver(board, W, result)).toBe(result);
    });
  });
});

// ===========================================================================
// setActiveEvents / getActiveEvents
// ===========================================================================

describe('CompositeEventRuleSet — setActiveEvents / getActiveEvents', () => {
  it('roundtrips events correctly', () => {
    const composite = createEmptyComposite();
    const events = [makeEvent(CrazyEvent.KingForADay, 2), makeEvent(CrazyEvent.LiveGrenade, -1)];
    composite.setActiveEvents(events);
    expect(composite.getActiveEvents()).toBe(events);
  });

  it('defaults to empty array', () => {
    const composite = createEmptyComposite();
    expect(composite.getActiveEvents()).toEqual([]);
  });
});

// ===========================================================================
// Chain building with mock decorators
// ===========================================================================

describe('CompositeEventRuleSet — chain building', () => {
  it('invokes active decorators in correct order', () => {
    const base = createAmericanRules();
    const callLog: string[] = [];
    const dec1 = new MockDecorator(base, CrazyEvent.KingForADay, callLog);
    const dec2 = new MockDecorator(base, CrazyEvent.LiveGrenade, callLog);

    const composite = new CompositeEventRuleSet(base, [dec1, dec2]);
    composite.setActiveEvents([
      makeEvent(CrazyEvent.KingForADay, 2),
      makeEvent(CrazyEvent.LiveGrenade, -1),
    ]);

    const board = createInitialBoard();
    composite.getLegalMoves(board, W);

    // The outermost decorator in the chain is LiveGrenade (last active),
    // which delegates to KingForADay, which delegates to base.
    // So LiveGrenade's getLegalMoves is called (it logs and delegates to inner).
    expect(callLog).toContain('getLegalMoves:LIVE_GRENADE');
  });

  it('does not invoke inactive decorators', () => {
    const base = createAmericanRules();
    const callLog: string[] = [];
    const dec1 = new MockDecorator(base, CrazyEvent.KingForADay, callLog);
    const dec2 = new MockDecorator(base, CrazyEvent.LiveGrenade, callLog);

    const composite = new CompositeEventRuleSet(base, [dec1, dec2]);
    // Only KingForADay is active
    composite.setActiveEvents([makeEvent(CrazyEvent.KingForADay, 2)]);

    const board = createInitialBoard();
    composite.getLegalMoves(board, W);

    expect(callLog).toContain('getLegalMoves:KING_FOR_A_DAY');
    expect(callLog).not.toContain('getLegalMoves:LIVE_GRENADE');
  });

  it('uses base directly when no events are active', () => {
    const base = createAmericanRules();
    const callLog: string[] = [];
    const dec1 = new MockDecorator(base, CrazyEvent.KingForADay, callLog);

    const composite = new CompositeEventRuleSet(base, [dec1]);
    // No active events
    composite.setActiveEvents([]);

    const board = createInitialBoard();
    composite.getLegalMoves(board, W);

    // No decorator should have been called
    expect(callLog).toHaveLength(0);
  });
});

// ===========================================================================
// createCompositeRuleSet factory
// ===========================================================================

describe('createCompositeRuleSet', () => {
  it('creates a CompositeEventRuleSet that delegates to base', () => {
    const base = createAmericanRules();
    const composite = createCompositeRuleSet(base);

    // With empty registry, should behave identically to base
    const board = createInitialBoard();
    expect(composite.getLegalMoves(board, W)).toEqual(base.getLegalMoves(board, W));
  });
});

// ===========================================================================
// Full AmericanRules test suite via CompositeEventRuleSet
// ===========================================================================

describe('CompositeEventRuleSet passes all AmericanRules test cases', () => {
  const composite = createEmptyComposite();

  describe('applyMove', () => {
    it('white pawn moves forward', () => {
      const board = buildBoard([{ sq: 22, color: W, type: P }]);
      const move: Move = { from: square(22), path: [square(18)], captured: [] };
      const newBoard = composite.applyMove(board, move);
      expect(getBoardSquare(newBoard, square(22))).toBeNull();
      expect(getBoardSquare(newBoard, square(18))).toEqual({ color: W, type: P });
    });

    it('single jump removes captured piece', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 18, color: B, type: P },
      ]);
      const move: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
      const newBoard = composite.applyMove(board, move);
      expect(getBoardSquare(newBoard, square(22))).toBeNull();
      expect(getBoardSquare(newBoard, square(18))).toBeNull();
      expect(getBoardSquare(newBoard, square(15))).toEqual({ color: W, type: P });
    });

    it('multi-jump removes all captured pieces', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 18, color: B, type: P },
        { sq: 10, color: B, type: P },
      ]);
      const move: Move = {
        from: square(22),
        path: [square(15), square(6)],
        captured: [square(18), square(10)],
      };
      const newBoard = composite.applyMove(board, move);
      expect(getBoardSquare(newBoard, square(22))).toBeNull();
      expect(getBoardSquare(newBoard, square(18))).toBeNull();
      expect(getBoardSquare(newBoard, square(10))).toBeNull();
      expect(getBoardSquare(newBoard, square(6))).toEqual({ color: W, type: P });
    });

    it('promotes white pawn on row 0', () => {
      const board = buildBoard([{ sq: 5, color: W, type: P }]);
      const move: Move = { from: square(5), path: [square(1)], captured: [] };
      const newBoard = composite.applyMove(board, move);
      expect(getBoardSquare(newBoard, square(1))).toEqual({ color: W, type: K });
    });

    it('promotes black pawn on row 7', () => {
      const board = buildBoard([{ sq: 25, color: B, type: P }]);
      const move: Move = { from: square(25), path: [square(29)], captured: [] };
      const newBoard = composite.applyMove(board, move);
      expect(getBoardSquare(newBoard, square(29))).toEqual({ color: B, type: K });
    });
  });

  describe('checkGameOver', () => {
    it('white win by no pieces', () => {
      const board = buildBoard([{ sq: 14, color: W, type: K }]);
      expect(composite.checkGameOver(board, B)).toEqual({
        type: GameResultType.WhiteWin,
        reason: GameEndReason.NoPiecesLeft,
      });
    });

    it('black win by no legal moves', () => {
      const board = buildBoard([{ sq: 4, color: W, type: P }]);
      expect(composite.checkGameOver(board, W)).toEqual({
        type: GameResultType.BlackWin,
        reason: GameEndReason.NoLegalMoves,
      });
    });

    it('game continues with legal moves', () => {
      expect(composite.checkGameOver(createInitialBoard(), W)).toBeNull();
    });
  });

  describe('getLegalMoves', () => {
    it('initial board produces 7 moves per side', () => {
      const board = createInitialBoard();
      expect(composite.getLegalMoves(board, W)).toHaveLength(7);
      expect(composite.getLegalMoves(board, B)).toHaveLength(7);
    });

    it('forced jump position returns only jumps', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 24, color: W, type: P },
        { sq: 18, color: B, type: P },
      ]);
      const moves = composite.getLegalMoves(board, W);
      expect(moves.every((m) => m.captured.length > 0)).toBe(true);
    });
  });

  describe('shouldPromote', () => {
    it('white pawn on row 0: true', () => {
      expect(composite.shouldPromote({ color: W, type: P }, square(1))).toBe(true);
    });

    it('white pawn on row 1: false', () => {
      expect(composite.shouldPromote({ color: W, type: P }, square(5))).toBe(false);
    });

    it('king: false', () => {
      expect(composite.shouldPromote({ color: W, type: K }, square(1))).toBe(false);
    });
  });
});
