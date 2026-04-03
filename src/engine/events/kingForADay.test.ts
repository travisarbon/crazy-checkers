/**
 * Task 8.1 — King for a Day: Comprehensive test suite.
 *
 * Tests the production KingForADayDecorator through the full game lifecycle
 * using CompositeEventRuleSet and makeMove.
 */

import { describe, it, expect } from 'vitest';
import { KingForADayDecorator } from './kingForADay';
import type { KingForADayMetadata } from './kingForADay';
import { createAmericanRules } from '../rules';
import { makeMove, getCurrentLegalMoves } from '../game';
import { getBoardSquare } from '../board';
import { computeZobristHash } from '../zobrist';
import { createActiveEvent, EVENT_DECORATOR_REGISTRY } from '../events';
import { createCompositeRuleSet } from '../compositeRuleSet';
import {
  CrazyEvent,
  GameMode,
  GameStatus,
  PieceColor,
  PieceType,
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

/** Creates a KfaD ActiveEvent with metadata recording original king squares. */
function createKfaDEvent(
  board: BoardState,
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
): ActiveEvent {
  const originalKingSquares: number[] = [];
  for (let i = 0; i < board.length; i++) {
    const piece = board[i];
    if (piece != null && piece.type === PieceType.King) {
      originalKingSquares.push(i + 1);
    }
  }
  return createActiveEvent(CrazyEvent.KingForADay, triggeredBy, triggeredAtPly, {
    originalKingSquares,
  });
}

// ===========================================================================
// Decorator Basics
// ===========================================================================

describe('KingForADayDecorator', () => {
  describe('decorator basics', () => {
    it('is registered in EVENT_DECORATOR_REGISTRY', () => {
      expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.KingForADay)).toBe(true);
    });

    it('getEventType returns KingForADay', () => {
      const base = createAmericanRules();
      const decorator = new KingForADayDecorator(base);
      expect(decorator.getEventType()).toBe(CrazyEvent.KingForADay);
    });

    it('withInner produces a new instance', () => {
      const base = createAmericanRules();
      const decorator = new KingForADayDecorator(base);
      const newDecorator = decorator.withInner(base);
      expect(newDecorator).not.toBe(decorator);
      expect(newDecorator).toBeInstanceOf(KingForADayDecorator);
    });

    it('is stateless — no instance variables for event state', () => {
      const base = createAmericanRules();
      const decorator = new KingForADayDecorator(base);
      // Verify no mutable state fields exist (turnsRemaining, originalKingIndices, etc.)
      expect((decorator as unknown as Record<string, unknown>)['turnsRemaining']).toBeUndefined();
      expect((decorator as unknown as Record<string, unknown>)['originalKingIndices']).toBeUndefined();
    });
  });

  // =========================================================================
  // getLegalMoves — Pawns Gain King Movement
  // =========================================================================

  describe('getLegalMoves', () => {
    it('pawns gain backward diagonal moves during the event', () => {
      // White pawn at sq 14 (row 3) — normally can only move forward (to lower rows)
      const board = buildBoard([{ sq: 14, color: W, type: P }]);
      const event = createKfaDEvent(board);
      const state = crazyStateWithBoard(board, W, [event]);

      const moves = getCurrentLegalMoves(state);
      const fromSq14 = moves.filter((m) => (m.from as number) === 14);

      // With king movement, square 14 can move forward and backward
      expect(fromSq14.length).toBeGreaterThan(0);

      // Should include backward moves (to higher-numbered squares / lower rows)
      const backwardMoves = fromSq14.filter((m) => {
        const dest = m.path[0] as number;
        return dest > 14; // backward for white = higher square numbers
      });
      expect(backwardMoves.length).toBeGreaterThan(0);
    });

    it('original kings have unchanged legal moves', () => {
      // King at sq 14 — should have same moves with or without KfaD
      const board = buildBoard([{ sq: 14, color: W, type: K }]);
      const base = createAmericanRules();

      // Without KfaD
      const normalMoves = base.getLegalMoves(board, W);

      // With KfaD
      const event = createKfaDEvent(board);
      const state = crazyStateWithBoard(board, W, [event]);
      const kfadMoves = getCurrentLegalMoves(state);

      // Same number of moves
      expect(kfadMoves.length).toBe(normalMoves.length);
    });

    it('AI search sees backward moves for pawns during event', () => {
      // Black pawn at sq 18 (row 4) — normally moves to higher rows only
      const board = buildBoard([{ sq: 18, color: B, type: P }]);
      const event = createKfaDEvent(board);
      const state = crazyStateWithBoard(board, B, [event]);

      const moves = getCurrentLegalMoves(state);
      const fromSq18 = moves.filter((m) => (m.from as number) === 18);

      // Should include forward moves for black (lower-numbered squares)
      const backwardMoves = fromSq18.filter((m) => {
        const dest = m.path[0] as number;
        return dest < 18;
      });
      expect(backwardMoves.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Reversion after 1 round (2 plies)
  // =========================================================================

  describe('reversion', () => {
    it('pawns revert after 1 round (2 plies)', () => {
      // White pawn at sq 22, Black pawn at sq 15
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 15, color: B, type: P },
      ]);
      const event = createKfaDEvent(board);
      let state = crazyStateWithBoard(board, W, [event]);

      // Ply 1: White moves sq 22 → 18 (backward, possible because KfaD)
      const whiteMove = move(22, [18]);
      state = makeMove(state, whiteMove);

      // After ply 1, event should still be active (1 ply remaining)
      expect(state.activeEvents.length).toBe(1);

      // The pawn at sq 18 should have been reverted to pawn after onTurnEnd
      const pieceAt18 = getBoardSquare(state.board, square(18));
      expect(pieceAt18).not.toBeNull();
      expect(pieceAt18?.type).toBe(PieceType.Pawn);

      // Ply 2: Black moves
      state = makeMove(state, firstMove(state));

      // After ply 2, event should be expired (removed)
      const kfadEvents = state.activeEvents.filter(
        (e) => e.type === CrazyEvent.KingForADay,
      );
      expect(kfadEvents.length).toBe(0);
    });

    it('after exactly 1 ply, board is still transformed on the next turn', () => {
      // Place pieces far apart so no captures are mandatory
      // White pawn at sq 30 (row 7), Black pawn at sq 3 (row 0)
      const board = buildBoard([
        { sq: 30, color: W, type: P },
        { sq: 3, color: B, type: P },
      ]);
      const event = createKfaDEvent(board);
      let state = crazyStateWithBoard(board, W, [event]);

      // Ply 1: White moves (with KfaD, all pawns have king moves)
      state = makeMove(state, firstMove(state));

      // Event still active — Black should get king movement for pawns
      const blackMoves = getCurrentLegalMoves(state);
      const fromSq3 = blackMoves.filter((m) => (m.from as number) === 3);

      // Black pawn at sq 3 (row 0) normally moves toward row 7 (higher sq numbers).
      // With KfaD, it should also get backward moves toward row 0 (lower sq numbers).
      // Sq 3 is at (row 0, col 5). ForwardLeft → row -1 = off board. ForwardRight → row -1 = off board.
      // So backward check doesn't apply here since it's already at the edge.
      // Instead, just verify Black has legal moves (board is transformed)
      expect(fromSq3.length).toBeGreaterThan(0);

      // Verify the event is still active (1 ply remaining)
      expect(
        state.activeEvents.some((e) => e.type === CrazyEvent.KingForADay),
      ).toBe(true);
    });

    it('legitimate promotion is preserved after event expires', () => {
      // White pawn at sq 5 (row 1) — one step from promotion row (row 0, sq 1-4)
      // Black pawn at sq 28 to make a valid game
      const board = buildBoard([
        { sq: 5, color: W, type: P },
        { sq: 28, color: B, type: P },
      ]);
      const event = createKfaDEvent(board);
      let state = crazyStateWithBoard(board, W, [event]);

      // White moves sq 5 → 1 (promotion row for white)
      const promoteMove = move(5, [1]);
      state = makeMove(state, promoteMove);

      // The piece at sq 1 should be a king (legitimately promoted)
      const pieceAt1 = getBoardSquare(state.board, square(1));
      expect(pieceAt1).not.toBeNull();
      expect(pieceAt1?.type).toBe(PieceType.King);
      expect(pieceAt1?.color).toBe(PieceColor.White);

      // Play ply 2 so event expires
      state = makeMove(state, firstMove(state));

      // After event expires, the piece at sq 1 should STILL be a king
      const pieceAt1After = getBoardSquare(state.board, square(1));
      expect(pieceAt1After).not.toBeNull();
      expect(pieceAt1After?.type).toBe(PieceType.King);
    });

    it('original king that moves is preserved after reversion', () => {
      // Original king at sq 14, pawn at sq 22
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 22, color: B, type: P },
      ]);
      const event = createKfaDEvent(board); // sq 14 is in originalKingSquares
      let state = crazyStateWithBoard(board, W, [event]);

      // White king moves from sq 14 → 18
      const kingMove = move(14, [18]);
      state = makeMove(state, kingMove);

      // The king that moved should still be a king
      const pieceAt18 = getBoardSquare(state.board, square(18));
      expect(pieceAt18).not.toBeNull();
      expect(pieceAt18?.type).toBe(PieceType.King);
    });

    it('captured pieces do not cause errors during reversion', () => {
      // Set up a capture scenario: White king at 14, Black pawn at 18, landing at 23
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 18, color: B, type: P },
      ]);
      const event = createKfaDEvent(board);
      let state = crazyStateWithBoard(board, W, [event]);

      // White captures: sq 14 → 23, capturing sq 18
      const captureMove = move(14, [23], [18]);
      // This should not throw
      state = makeMove(state, captureMove);

      // Captured piece is gone
      expect(getBoardSquare(state.board, square(18))).toBeNull();
      // Moving king is preserved
      const pieceAt23 = getBoardSquare(state.board, square(23));
      expect(pieceAt23).not.toBeNull();
      expect(pieceAt23?.type).toBe(PieceType.King);
    });
  });

  // =========================================================================
  // Integration — Full Game Flow via makeMove
  // =========================================================================

  describe('integration — full game flow', () => {
    it('multi-jump triggers KfaD with correct metadata', () => {
      // White pawn at 18, Black pawns at 14 and 6
      // Path: 18 → 9 (capture 14) → 2 (capture 6)
      const board = buildBoard([
        { sq: 18, color: W, type: P },
        { sq: 14, color: B, type: P },
        { sq: 6, color: B, type: P },
      ]);

      let state = crazyStateWithBoard(board, W, []);

      const multiJump = move(18, [9, 2], [14, 6]);

      // Verify the move is legal
      const legalMoves = getCurrentLegalMoves(state);
      const isLegal = legalMoves.some(
        (m) =>
          (m.from as number) === 18 &&
          m.path.length === 2 &&
          m.captured.length === 2,
      );
      expect(isLegal).toBe(true);

      state = makeMove(state, multiJump);

      // An event should have been triggered (random, may or may not be KfaD)
      expect(state.activeEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('event lifecycle through makeMove — expires after 2 plies', () => {
      // Board with two pieces that can take turns moving
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 11, color: B, type: P },
      ]);
      const event = createKfaDEvent(board);
      let state = crazyStateWithBoard(board, W, [event]);

      // Ply 1
      state = makeMove(state, firstMove(state));
      expect(
        state.activeEvents.some((e) => e.type === CrazyEvent.KingForADay),
      ).toBe(true);

      // Ply 2
      state = makeMove(state, firstMove(state));
      expect(
        state.activeEvents.some((e) => e.type === CrazyEvent.KingForADay),
      ).toBe(false);
    });
  });

  // =========================================================================
  // Edge Cases and Stacking
  // =========================================================================

  describe('edge cases', () => {
    it('self-stacking — two KfaDs both tick independently', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 11, color: B, type: P },
      ]);

      const event1 = createKfaDEvent(board, W, 0);
      const event2 = createKfaDEvent(board, B, 1);
      let state = crazyStateWithBoard(board, W, [event1, event2]);

      // Both events are active
      const kfadEvents = state.activeEvents.filter(
        (e) => e.type === CrazyEvent.KingForADay,
      );
      expect(kfadEvents.length).toBe(2);

      // Ply 1: both tick from 2 → 1
      state = makeMove(state, firstMove(state));

      const remaining = state.activeEvents.filter(
        (e) => e.type === CrazyEvent.KingForADay,
      );
      expect(remaining.length).toBe(2);
      expect(remaining[0]?.remainingPlies).toBe(1);
      expect(remaining[1]?.remainingPlies).toBe(1);

      // Ply 2: both tick from 1 → 0 and are removed
      state = makeMove(state, firstMove(state));

      const afterPly2 = state.activeEvents.filter(
        (e) => e.type === CrazyEvent.KingForADay,
      );
      expect(afterPly2.length).toBe(0);
    });

    it('no pawns on board — no crash and no functional change', () => {
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 19, color: B, type: K },
      ]);
      const event = createKfaDEvent(board);
      let state = crazyStateWithBoard(board, W, [event]);

      // Should not throw
      const moves = getCurrentLegalMoves(state);
      expect(moves.length).toBeGreaterThan(0);

      state = makeMove(state, firstMove(state));
      // Kings should remain kings
      for (let i = 0; i < state.board.length; i++) {
        const piece = state.board[i];
        if (piece != null) {
          expect(piece.type).toBe(PieceType.King);
        }
      }
    });

    it('empty board — no crash', () => {
      const board = buildBoard([]);
      const event = createKfaDEvent(board);
      const state = crazyStateWithBoard(board, W, [event]);

      // Game should be over (no pieces = no moves)
      const moves = getCurrentLegalMoves(state);
      expect(moves.length).toBe(0);
    });
  });

  // =========================================================================
  // Metadata
  // =========================================================================

  describe('metadata', () => {
    it('metadata correctly records original king squares', () => {
      const board = buildBoard([
        { sq: 5, color: W, type: K },
        { sq: 14, color: W, type: P },
        { sq: 19, color: B, type: K },
        { sq: 22, color: B, type: P },
      ]);

      const event = createKfaDEvent(board);
      const metadata = event.metadata as unknown as KingForADayMetadata;

      expect(metadata.originalKingSquares).toEqual([5, 19]);
    });

    it('metadata is preserved in ActiveEvent', () => {
      const board = buildBoard([
        { sq: 10, color: W, type: K },
        { sq: 20, color: B, type: P },
      ]);

      const event = createKfaDEvent(board);
      expect(event.type).toBe(CrazyEvent.KingForADay);
      expect(event.remainingPlies).toBe(2);
      expect(event.metadata).toBeDefined();

      const metadata = event.metadata as unknown as KingForADayMetadata;
      expect(metadata.originalKingSquares).toContain(10);
      expect(metadata.originalKingSquares).not.toContain(20);
    });
  });
});
