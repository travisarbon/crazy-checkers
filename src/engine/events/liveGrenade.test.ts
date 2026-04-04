/**
 * Task 8.2 — Live Grenade: Comprehensive test suite.
 *
 * Tests the production LiveGrenadeDecorator through the full game lifecycle
 * using CompositeEventRuleSet and makeMove.
 */

import { describe, it, expect } from 'vitest';
import { LiveGrenadeDecorator, explodeAdjacentPieces } from './liveGrenade';
import { createAmericanRules } from '../rules';
import { makeMove, getCurrentLegalMoves } from '../game';
import { getBoardSquare } from '../board';
import { computeZobristHash } from '../zobrist';
import {
  createActiveEvent,
  IMPLEMENTED_EVENTS,
  EVENT_DECORATOR_REGISTRY,
} from '../events';
import { createCompositeRuleSet } from '../compositeRuleSet';
import {
  CrazyEvent,
  GameMode,
  GameStatus,
  PieceColor,
  PlayerType,
  square,
} from '../types';
import type {
  ActiveEvent,
  BoardState,
  GameState,
  Move,
  PlayerSetup,
} from '../types';
import { W, B, P, K, buildBoard } from '../test-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HUMAN_VS_HUMAN: PlayerSetup = {
  white: PlayerType.Human,
  black: PlayerType.Human,
};

function move(from: number, path: number[], captured: number[] = []): Move {
  return {
    from: square(from),
    path: path.map(square),
    captured: captured.map(square),
  };
}

/** Picks the first legal move, throwing if none exist. */
function firstMove(state: GameState): Move {
  const moves = getCurrentLegalMoves(state);
  const first = moves[0];
  if (first === undefined) throw new Error('No legal moves');
  return first;
}

/** Creates a Crazy mode GameState with a custom board and active events. */
function crazyStateWithBoard(
  board: BoardState,
  activeColor: PieceColor = PieceColor.White,
  activeEvents: readonly ActiveEvent[] = [],
  plyCount = 0,
): GameState {
  const base = createAmericanRules();
  const ruleSet = createCompositeRuleSet(base);
  return {
    board,
    activeColor,
    status: GameStatus.InProgress,
    result: null,
    ruleSet,
    players: HUMAN_VS_HUMAN,
    moveHistory: [],
    positionHashes: [computeZobristHash(board, activeColor)],
    halfMoveClock: 0,
    plyCount,
    mode: GameMode.Crazy,
    activeEvents,
  };
}

/** Creates a Live Grenade ActiveEvent (condition-based, remainingPlies = -1). */
function createLGEvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.LiveGrenade, triggeredBy, triggeredAtPly);
}

// ===========================================================================
// Unit Tests — Pure Helper Function (explodeAdjacentPieces)
// ===========================================================================

describe('explodeAdjacentPieces', () => {
  it('destroys all 4 adjacent pieces at a center square', () => {
    // Sq 14 (row 3, col 2) has neighbors: 9, 10, 17, 18
    const board = buildBoard([
      { sq: 14, color: W, type: K }, // center piece (should survive)
      { sq: 9, color: B, type: P },
      { sq: 10, color: B, type: P },
      { sq: 17, color: W, type: P },
      { sq: 18, color: W, type: P },
    ]);

    const result = explodeAdjacentPieces(board, square(14));

    // Center piece survives
    expect(getBoardSquare(result, square(14))).not.toBeNull();
    // All 4 neighbors destroyed
    expect(getBoardSquare(result, square(9))).toBeNull();
    expect(getBoardSquare(result, square(10))).toBeNull();
    expect(getBoardSquare(result, square(17))).toBeNull();
    expect(getBoardSquare(result, square(18))).toBeNull();
  });

  it('landing piece survives the explosion', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 9, color: B, type: P },
    ]);

    const result = explodeAdjacentPieces(board, square(14));

    const landingPiece = getBoardSquare(result, square(14));
    expect(landingPiece).not.toBeNull();
    expect(landingPiece?.color).toBe(PieceColor.White);
  });

  it('destroys friendly pieces', () => {
    // All neighbors are same color as center
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 9, color: W, type: P },
      { sq: 10, color: W, type: P },
      { sq: 17, color: W, type: P },
      { sq: 18, color: W, type: P },
    ]);

    const result = explodeAdjacentPieces(board, square(14));

    expect(getBoardSquare(result, square(9))).toBeNull();
    expect(getBoardSquare(result, square(10))).toBeNull();
    expect(getBoardSquare(result, square(17))).toBeNull();
    expect(getBoardSquare(result, square(18))).toBeNull();
  });

  it('handles empty adjacent squares without crashing', () => {
    // Only center piece, no neighbors
    const board = buildBoard([{ sq: 14, color: W, type: K }]);

    const result = explodeAdjacentPieces(board, square(14));

    expect(getBoardSquare(result, square(14))).not.toBeNull();
    // Neighbors were already null — still null
    expect(getBoardSquare(result, square(9))).toBeNull();
    expect(getBoardSquare(result, square(10))).toBeNull();
  });

  it('non-adjacent pieces survive', () => {
    // Piece far from explosion center
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 30, color: B, type: P }, // far away
    ]);

    const result = explodeAdjacentPieces(board, square(14));

    expect(getBoardSquare(result, square(30))).not.toBeNull();
  });

  it('handles edge square with fewer than 4 neighbors', () => {
    // Sq 5 (row 1, col 0) has neighbors: 1, 9 (only 2)
    const board = buildBoard([
      { sq: 5, color: W, type: K },
      { sq: 1, color: B, type: P },
      { sq: 9, color: B, type: P },
    ]);

    const result = explodeAdjacentPieces(board, square(5));

    expect(getBoardSquare(result, square(5))).not.toBeNull();
    expect(getBoardSquare(result, square(1))).toBeNull();
    expect(getBoardSquare(result, square(9))).toBeNull();
  });

  it('does not mutate the original board (pure function)', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 9, color: B, type: P },
    ]);
    const boardCopy = [...board];

    explodeAdjacentPieces(board, square(14));

    // Original board unchanged
    for (let i = 0; i < board.length; i++) {
      expect(board[i]).toBe(boardCopy[i]);
    }
  });
});

// ===========================================================================
// Unit Tests — Decorator Behavior
// ===========================================================================

describe('LiveGrenadeDecorator', () => {
  describe('decorator basics', () => {
    it('getEventType returns LiveGrenade', () => {
      const base = createAmericanRules();
      const decorator = new LiveGrenadeDecorator(base);
      expect(decorator.getEventType()).toBe(CrazyEvent.LiveGrenade);
    });

    it('withInner produces a new instance', () => {
      const base = createAmericanRules();
      const decorator = new LiveGrenadeDecorator(base);
      const newDecorator = decorator.withInner(base);
      expect(newDecorator).not.toBe(decorator);
      expect(newDecorator).toBeInstanceOf(LiveGrenadeDecorator);
    });

    it('is stateless — no instance variables for armed state', () => {
      const base = createAmericanRules();
      const decorator = new LiveGrenadeDecorator(base);
      expect((decorator as unknown as Record<string, unknown>)['armed']).toBeUndefined();
      expect((decorator as unknown as Record<string, unknown>)['detonated']).toBeUndefined();
    });

    it('onCapture applies explosion and requests removal', () => {
      const base = createAmericanRules();
      const decorator = new LiveGrenadeDecorator(base);

      // Sq 15 (row 3, col 4) neighbors: 10, 11, 18, 19
      const board = buildBoard([
        { sq: 15, color: W, type: K }, // landing piece
        { sq: 10, color: B, type: P },
        { sq: 11, color: B, type: P },
        { sq: 18, color: B, type: P },
        { sq: 19, color: B, type: P },
      ]);

      const result = decorator.onCapture(board, square(15), [square(22)]);

      // Adjacent pieces destroyed
      expect(getBoardSquare(result, square(10))).toBeNull();
      expect(getBoardSquare(result, square(11))).toBeNull();
      expect(getBoardSquare(result, square(18))).toBeNull();
      expect(getBoardSquare(result, square(19))).toBeNull();
      // Landing survives
      expect(getBoardSquare(result, square(15))).not.toBeNull();

      // Verify removal was requested
      const removals = decorator.drainPendingRemovals();
      expect(removals).toContain(CrazyEvent.LiveGrenade);
    });

    it('getLegalMoves is unchanged (no override)', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 18, color: B, type: P },
      ]);

      // Without Live Grenade
      const base = createAmericanRules();
      const normalMoves = base.getLegalMoves(board, W);

      // With Live Grenade
      const event = createLGEvent();
      const state = crazyStateWithBoard(board, W, [event]);
      const lgMoves = getCurrentLegalMoves(state);

      expect(lgMoves.length).toBe(normalMoves.length);
    });
  });

  // =========================================================================
  // Integration Tests — Full Game Flow via makeMove
  // =========================================================================

  describe('integration — full game flow', () => {
    it('capture triggers explosion and removes event', () => {
      // White king at 14 jumps over Black at 10 landing at 7.
      // Sq 7 neighbors: 2, 3, 10, 11. Sq 10 is captured (null after applyMove).
      // Place collateral at 2, 3 (row 0, can't be jumped over — off board).
      // Sq 11 is at (2,5); from 7 (1,4), jump over 11 to (3,6)=16. 11 is an
      // enemy so king could multi-jump. Avoid by making 11 friendly (White).
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 10, color: B, type: P }, // captured
        { sq: 2, color: B, type: P }, // collateral (neighbor of landing sq 7)
        { sq: 3, color: B, type: P }, // collateral
        { sq: 11, color: W, type: P }, // friendly collateral
      ]);
      const event = createLGEvent();
      let state = crazyStateWithBoard(board, W, [event]);

      const captureMove = move(14, [7], [10]);
      state = makeMove(state, captureMove);

      // Adjacent pieces destroyed by explosion
      expect(getBoardSquare(state.board, square(2))).toBeNull();
      expect(getBoardSquare(state.board, square(3))).toBeNull();
      expect(getBoardSquare(state.board, square(11))).toBeNull();
      // Landing piece survives
      expect(getBoardSquare(state.board, square(7))).not.toBeNull();
      // Event consumed
      expect(
        state.activeEvents.some((e) => e.type === CrazyEvent.LiveGrenade),
      ).toBe(false);
    });

    it('non-capture move preserves armed event', () => {
      // White pawn at 22, Black pawn far away at 3
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 3, color: B, type: P },
      ]);
      const event = createLGEvent();
      let state = crazyStateWithBoard(board, W, [event]);

      // Simple non-capture move
      const simpleMove = move(22, [18]);
      state = makeMove(state, simpleMove);

      // Event still active
      expect(
        state.activeEvents.some((e) => e.type === CrazyEvent.LiveGrenade),
      ).toBe(true);
    });

    it('explosion causing game over (all opponent pieces destroyed)', () => {
      // White king at 22, Black pawn at 18 (captured), Black pawn at 19 (collateral).
      // Sq 15 neighbors: 10, 11, 18, 19. After capture, 18 is null.
      // Collateral at 19 is destroyed by explosion. No multi-jump forced since
      // 19 (row 4, col 5) is not jumpable from 15 (row 3, col 4) — jump would be
      // to (row 5, col 6) = sq 24, which is valid, but 19 is the adjacent, not
      // an opponent in the path. Actually let's verify: from sq 15 (3,4),
      // backward-right goes to (4,5)=19 then (5,6)=24. So a king COULD jump
      // over 19 if it's an opponent. Let me use sq 10 but ensure no multi-jump
      // by making 10 a friendly piece instead.
      // Actually simplest: use the test where the only Black piece aside from
      // captured is at a spot that's a neighbor but NOT jumpable.
      // Sq 15 neighbors: 10 (row 2,col 3), 11 (row 2,col 5), 18, 19.
      // From sq 15: can jump over 10 to 6, over 11 to 8, over 19 to 24.
      // All are jumpable for a king. So place the collateral piece as friendly
      // White at those spots, and the single Black piece at 18 (captured).
      // That won't create game over though since there's no remaining Black.
      // Wait, if Black's only piece is at 18 (captured), game is already over
      // from the capture alone without needing explosion.
      // Better approach: Black has one more piece far away, and one in blast radius.
      // Actually the simplest game-over-by-explosion: Black has two pieces,
      // one is captured, one is destroyed by explosion and isn't jumpable.
      // Use a pawn (not king) at sq 22 instead of king, so multi-jump isn't available
      // since pawns can't jump backward. Sq 22→15 is a forward jump.
      // From 15, pawn can only jump forward (toward row 0). 10 at (2,3) and 11 at (2,5)
      // are forward from 15 (3,4). So pawn CAN multi-jump!
      // Use Black pawn at sq 17 (row 4, col 1) as collateral — it's a neighbor of 14, not 15.
      // Hmm, this is getting complex. Let me use a different capture square.
      // White king at 14 (row 3, col 2), Black pawn at 10 (row 2, col 3), lands at 7 (row 1, col 4).
      // Sq 7 neighbors: 3 (row 0, col 5), 2 (row 0, col 3), 10 (row 2, col 3), 11 (row 2, col 5).
      // 10 is already captured. Place Black pawn at 3 as collateral.
      // From 7 (row 1, col 4), can king jump over 3 at (0,5) to... off board. So no multi-jump!
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 10, color: B, type: P }, // captured
        { sq: 3, color: B, type: P }, // collateral (neighbor of landing sq 7)
      ]);
      const event = createLGEvent();
      let state = crazyStateWithBoard(board, W, [event]);

      const captureMove = move(14, [7], [10]);
      state = makeMove(state, captureMove);

      // Explosion at sq 7 destroys sq 3, the last Black piece
      expect(getBoardSquare(state.board, square(3))).toBeNull();
      expect(state.status).toBe(GameStatus.GameOver);
    });

    it('explosion destroys friendly collateral but landing piece survives', () => {
      // White king at 14, White pawn at 2 (friendly collateral, neighbor of sq 7).
      // Black pawn at 10 (captured). Black king at 20 (far away, survives, has moves).
      // Landing = sq 7. Neighbors: 2, 3, 10, 11.
      // Explosion destroys friendly pawn at 2.
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 2, color: W, type: P }, // friendly collateral
        { sq: 10, color: B, type: P }, // captured
        { sq: 20, color: B, type: K }, // survives, has legal moves
      ]);
      const event = createLGEvent();
      let state = crazyStateWithBoard(board, W, [event]);

      const captureMove = move(14, [7], [10]);
      state = makeMove(state, captureMove);

      // Friendly pawn destroyed
      expect(getBoardSquare(state.board, square(2))).toBeNull();
      // Landing piece survives
      expect(getBoardSquare(state.board, square(7))).not.toBeNull();
      // Game continues (Black still has king at 20)
      expect(state.status).toBe(GameStatus.InProgress);
    });

    it('multi-jump + explosion at final landing square', () => {
      // White king at 26, Black pawns at 22 and 15.
      // Multi-jump: 26 → 17 (capture 22) → 10 (capture 15). Wait, let me verify.
      // Sq 26 (row 6, col 3). Forward-left: (5,2)=22, jump: (4,1)=17.
      // Sq 17 (row 4, col 1). Forward-left: (3,0)=13, jump: (2,-1)=off.
      // Hmm, that doesn't chain. Let me pick better squares.

      // White king at 24, Black pawns at 20 and 11.
      // Sq 24 (row 5, col 6). Forward-right: (4,7)=20, jump: (3,8)=off.
      // Not great.

      // Let me use: White king at 22 (row 5, col 2).
      // Jump over 18 (row 4, col 3) to 15 (row 3, col 4).
      // From 15, jump over 11 (row 2, col 5) to 8 (row 1, col 6).
      // Multi-jump: 22 → 15 → 8, capturing [18, 11].
      // Landing = sq 8 (row 1, col 6). Neighbors: (0,5)=3, (0,7)=4, (2,5)=11, (2,7)=12.
      // Sq 11 was captured (already null). Explosion destroys 3, 4, 12.

      const board = buildBoard([
        { sq: 22, color: W, type: K },
        { sq: 18, color: B, type: P }, // captured in first jump
        { sq: 11, color: B, type: P }, // captured in second jump
        { sq: 3, color: B, type: P }, // collateral (adjacent to landing sq 8)
        { sq: 4, color: B, type: P }, // collateral
        { sq: 12, color: B, type: K }, // collateral
      ]);
      const event = createLGEvent();
      let state = crazyStateWithBoard(board, W, [event]);

      const multiJump = move(22, [15, 8], [18, 11]);
      state = makeMove(state, multiJump);

      // Collateral destroyed by explosion at landing sq 8
      expect(getBoardSquare(state.board, square(3))).toBeNull();
      expect(getBoardSquare(state.board, square(4))).toBeNull();
      expect(getBoardSquare(state.board, square(12))).toBeNull();
      // Landing piece survives
      expect(getBoardSquare(state.board, square(8))).not.toBeNull();
      // Original event consumed (the multi-jump may trigger a NEW random event,
      // so we check that the original event at ply 0 is gone)
      const originalLG = state.activeEvents.find(
        (e) => e.type === CrazyEvent.LiveGrenade && e.triggeredAtPly === 0,
      );
      expect(originalLG).toBeUndefined();
    });

    it('event persists across multiple non-capture turns', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 3, color: B, type: P },
      ]);
      const event = createLGEvent();
      let state = crazyStateWithBoard(board, W, [event]);

      // Several non-capture moves
      state = makeMove(state, firstMove(state)); // White
      expect(
        state.activeEvents.some((e) => e.type === CrazyEvent.LiveGrenade),
      ).toBe(true);

      state = makeMove(state, firstMove(state)); // Black
      expect(
        state.activeEvents.some((e) => e.type === CrazyEvent.LiveGrenade),
      ).toBe(true);

      state = makeMove(state, firstMove(state)); // White
      expect(
        state.activeEvents.some((e) => e.type === CrazyEvent.LiveGrenade),
      ).toBe(true);
    });

    it('condition-based event is not ticked by tickAllEvents', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 3, color: B, type: P },
      ]);
      const event = createLGEvent();
      let state = crazyStateWithBoard(board, W, [event]);

      state = makeMove(state, firstMove(state));

      // remainingPlies should still be -1 (not decremented)
      const lgEvent = state.activeEvents.find(
        (e) => e.type === CrazyEvent.LiveGrenade,
      );
      expect(lgEvent).toBeDefined();
      expect(lgEvent?.remainingPlies).toBe(-1);
    });
  });

  // =========================================================================
  // Stacking and Multi-Event Tests
  // =========================================================================

  describe('stacking and multi-event', () => {
    it('two stacked Live Grenades — both consumed on single capture', () => {
      // White king at 14, Black pawn at 10. Simple capture with no multi-jump.
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 10, color: B, type: P },
        { sq: 30, color: B, type: P }, // ensure game doesn't end
      ]);
      const event1 = createLGEvent(W, 0);
      const event2 = createLGEvent(B, 1);
      let state = crazyStateWithBoard(board, W, [event1, event2]);

      // Both active
      expect(
        state.activeEvents.filter((e) => e.type === CrazyEvent.LiveGrenade).length,
      ).toBe(2);

      const captureMove = move(14, [7], [10]);
      state = makeMove(state, captureMove);

      // Both consumed (removeEventsByType removes all of that type)
      expect(
        state.activeEvents.filter((e) => e.type === CrazyEvent.LiveGrenade).length,
      ).toBe(0);
    });

    it('Live Grenade + King for a Day coexistence', () => {
      // Both active simultaneously. Capture during KfaD triggers explosion.
      // White king at 14, Black pawn at 10 (captured), lands at 7.
      // Collateral at 3 (neighbor of sq 7, at row 0 — can't be jumped off-board).
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 10, color: B, type: P }, // captured
        { sq: 3, color: B, type: P }, // collateral (neighbor of landing sq 7)
        { sq: 30, color: B, type: P }, // survives (far away)
      ]);

      const kfadEvent = createActiveEvent(CrazyEvent.KingForADay, W, 0, {
        originalKingSquares: [14],
      });
      const lgEvent = createLGEvent(W, 0);
      let state = crazyStateWithBoard(board, W, [kfadEvent, lgEvent]);

      // Capture: 14 → 7 (over 10)
      const captureMove = move(14, [7], [10]);
      state = makeMove(state, captureMove);

      // Explosion at 7 destroys neighbors including sq 3
      expect(getBoardSquare(state.board, square(3))).toBeNull();
      // Live Grenade consumed
      expect(
        state.activeEvents.some((e) => e.type === CrazyEvent.LiveGrenade),
      ).toBe(false);
      // KfaD still active (1 ply remaining)
      expect(
        state.activeEvents.some((e) => e.type === CrazyEvent.KingForADay),
      ).toBe(true);
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('edge cases', () => {
    it('explosion at corner square (sq 29) — only 1 neighbor', () => {
      // Sq 29 (row 7, col 0) has only 1 neighbor: sq 25
      const board = buildBoard([
        { sq: 29, color: W, type: K },
        { sq: 25, color: B, type: P },
        { sq: 30, color: B, type: P }, // not adjacent to 29
      ]);

      const result = explodeAdjacentPieces(board, square(29));

      expect(getBoardSquare(result, square(29))).not.toBeNull();
      expect(getBoardSquare(result, square(25))).toBeNull();
      expect(getBoardSquare(result, square(30))).not.toBeNull(); // not adjacent, survives
    });

    it('explosion at edge square (sq 5) — 2 neighbors', () => {
      // Sq 5 (row 1, col 0) has 2 neighbors: 1 and 9
      const board = buildBoard([
        { sq: 5, color: W, type: K },
        { sq: 1, color: B, type: P },
        { sq: 9, color: B, type: P },
      ]);

      const result = explodeAdjacentPieces(board, square(5));

      expect(getBoardSquare(result, square(5))).not.toBeNull();
      expect(getBoardSquare(result, square(1))).toBeNull();
      expect(getBoardSquare(result, square(9))).toBeNull();
    });

    it('explosion with no adjacent pieces — event still consumed', () => {
      // White king at 14, Black pawn at 10 (captured). Landing at 7.
      // Neighbors of 7 are 2, 3, 10, 11 — all empty after capture.
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 10, color: B, type: P }, // captured
      ]);
      const event = createLGEvent();
      let state = crazyStateWithBoard(board, W, [event]);

      const captureMove = move(14, [7], [10]);
      state = makeMove(state, captureMove);

      // Event still consumed even though no explosion damage
      expect(
        state.activeEvents.some((e) => e.type === CrazyEvent.LiveGrenade),
      ).toBe(false);
    });

    it('explosion eliminates all opponent pieces triggers game over', () => {
      // White king at 14, Black pawn at 10 (captured), Black pawn at 3 (collateral).
      // Landing at 7. Neighbors: 2, 3, 10, 11. Sq 3 at (0,5) — can't jump off board.
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 10, color: B, type: P }, // captured
        { sq: 3, color: B, type: P }, // collateral (last Black piece, neighbor of sq 7)
      ]);
      const event = createLGEvent();
      let state = crazyStateWithBoard(board, W, [event]);

      const captureMove = move(14, [7], [10]);
      state = makeMove(state, captureMove);

      // Explosion at sq 7 destroys sq 3, the last Black piece
      expect(getBoardSquare(state.board, square(3))).toBeNull();
      expect(state.status).toBe(GameStatus.GameOver);
    });
  });

  // =========================================================================
  // Registration and Serialization
  // =========================================================================

  describe('registration', () => {
    it('is registered in EVENT_DECORATOR_REGISTRY', () => {
      expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.LiveGrenade)).toBe(true);
    });

    it('CrazyEvent.LiveGrenade is in IMPLEMENTED_EVENTS', () => {
      expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.LiveGrenade);
    });

    it('serialization round-trip preserves LiveGrenade event', () => {
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 10, color: B, type: P },
        { sq: 30, color: B, type: P }, // ensure game continues
      ]);
      const event = createLGEvent();
      const state = crazyStateWithBoard(board, W, [event]);

      // Simulate serialization round-trip by reconstructing state
      const serializedEvents = state.activeEvents.map((e) => ({ ...e }));
      const newState = crazyStateWithBoard(
        state.board,
        state.activeColor,
        serializedEvents,
        state.plyCount,
      );

      // Event preserved
      expect(
        newState.activeEvents.some((e) => e.type === CrazyEvent.LiveGrenade),
      ).toBe(true);

      // Can still make a capture and trigger explosion
      const captureMove = move(14, [7], [10]);
      const afterCapture = makeMove(newState, captureMove);

      // Event consumed after capture
      expect(
        afterCapture.activeEvents.some((e) => e.type === CrazyEvent.LiveGrenade),
      ).toBe(false);
    });
  });
});
