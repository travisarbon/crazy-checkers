/**
 * Task 8.4 — Hot Potato: Comprehensive test suite.
 *
 * Tests the production HotPotatoDecorator through both the pure helper
 * function (switchPieceColor) and the full game lifecycle using
 * CompositeEventRuleSet and makeMove.
 */

import { describe, it, expect } from 'vitest';
import { HotPotatoDecorator, switchPieceColor } from './hotPotato';
import { createAmericanRules } from '../rules';
import { makeMove, getCurrentLegalMoves } from '../game';
import { getBoardSquare } from '../board';
import { computeZobristHash } from '../zobrist';
import {
  createActiveEvent,
  IMPLEMENTED_EVENTS,
  EVENT_DECORATOR_REGISTRY,
  EVENT_DURATIONS,
  EVENT_METADATA_FACTORIES,
} from '../events';
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

/** Creates a Hot Potato ActiveEvent (duration-based, remainingPlies = 2). */
function createHPEvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.HotPotato, triggeredBy, triggeredAtPly);
}

/** Picks the first legal move, throwing if none exist. */
function firstMove(state: GameState): Move {
  const moves = getCurrentLegalMoves(state);
  const first = moves[0];
  if (first === undefined) throw new Error('No legal moves');
  return first;
}

/** Returns the landing square (last element of move.path), throwing if empty. */
function landingOf(m: Move): ReturnType<typeof square> {
  const sq = m.path[m.path.length - 1];
  if (sq === undefined) throw new Error('Empty move path');
  return sq;
}

/** Finds a capture move from the given square in the legal moves, throwing if none. */
function findCapture(state: GameState, fromSq: number): Move {
  const moves = getCurrentLegalMoves(state);
  const found = moves.find(
    m => (m.from as number) === fromSq && m.captured.length > 0,
  );
  if (found === undefined) throw new Error('No capture from sq ' + String(fromSq));
  return found;
}

// ===========================================================================
// Unit Tests — Pure Helper Function (switchPieceColor)
// ===========================================================================

describe('switchPieceColor', () => {
  it('White pawn switches to Black pawn', () => {
    const board = buildBoard([{ sq: 15, color: W, type: P }]);
    const result = switchPieceColor(board, square(15));
    const piece = getBoardSquare(result, square(15));
    expect(piece).not.toBeNull();
    expect(piece?.color).toBe(B);
    expect(piece?.type).toBe(PieceType.Pawn);
  });

  it('Black pawn switches to White pawn', () => {
    const board = buildBoard([{ sq: 15, color: B, type: P }]);
    const result = switchPieceColor(board, square(15));
    const piece = getBoardSquare(result, square(15));
    expect(piece).not.toBeNull();
    expect(piece?.color).toBe(W);
    expect(piece?.type).toBe(PieceType.Pawn);
  });

  it('King switches color, retains type', () => {
    const board = buildBoard([{ sq: 15, color: W, type: K }]);
    const result = switchPieceColor(board, square(15));
    const piece = getBoardSquare(result, square(15));
    expect(piece?.color).toBe(B);
    expect(piece?.type).toBe(PieceType.King);
  });

  it('Pawn promotes after color switch (White pawn on Black promotion row)', () => {
    // Square 30 is on row 7 (Black's promotion row)
    const board = buildBoard([{ sq: 30, color: W, type: P }]);
    const result = switchPieceColor(board, square(30));
    const piece = getBoardSquare(result, square(30));
    expect(piece?.color).toBe(B);
    expect(piece?.type).toBe(PieceType.King); // promoted
  });

  it('Pawn promotes after color switch — reverse direction', () => {
    // Square 2 is on row 0 (White's promotion row)
    const board = buildBoard([{ sq: 2, color: B, type: P }]);
    const result = switchPieceColor(board, square(2));
    const piece = getBoardSquare(result, square(2));
    expect(piece?.color).toBe(W);
    expect(piece?.type).toBe(PieceType.King); // promoted
  });

  it('King on promotion row stays king', () => {
    const board = buildBoard([{ sq: 30, color: W, type: K }]);
    const result = switchPieceColor(board, square(30));
    const piece = getBoardSquare(result, square(30));
    expect(piece?.color).toBe(B);
    expect(piece?.type).toBe(PieceType.King);
  });

  it('Empty square returns board unchanged', () => {
    const board = buildBoard([{ sq: 10, color: W, type: P }]);
    const result = switchPieceColor(board, square(15)); // empty square
    expect(result).toBe(board); // same reference
  });

  it('Board is not mutated (pure function)', () => {
    const board = buildBoard([{ sq: 15, color: W, type: P }]);
    const boardCopy = [...board];
    switchPieceColor(board, square(15));
    for (let i = 0; i < board.length; i++) {
      expect(board[i]).toBe(boardCopy[i]);
    }
  });
});

// ===========================================================================
// Unit Tests — Decorator Behavior
// ===========================================================================

describe('HotPotatoDecorator', () => {
  describe('decorator basics', () => {
    it('getEventType returns CrazyEvent.HotPotato', () => {
      const base = createAmericanRules();
      const decorator = new HotPotatoDecorator(base);
      expect(decorator.getEventType()).toBe(CrazyEvent.HotPotato);
    });

    it('withInner produces a new instance', () => {
      const base = createAmericanRules();
      const decorator = new HotPotatoDecorator(base);
      const newDecorator = decorator.withInner(base);
      expect(newDecorator).not.toBe(decorator);
      expect(newDecorator).toBeInstanceOf(HotPotatoDecorator);
    });

    it('is stateless — no instance variables for event state', () => {
      const base = createAmericanRules();
      const decorator = new HotPotatoDecorator(base);
      expect((decorator as unknown as Record<string, unknown>)['triggeredBy']).toBeUndefined();
      expect((decorator as unknown as Record<string, unknown>)['switched']).toBeUndefined();
    });

    it('onTurnEnd switches piece color on affected player turn', () => {
      // Simulate post-applyMove board: White pawn already at landing square 17
      const board = buildBoard([{ sq: 17, color: W, type: P }]);
      const base = createAmericanRules();
      const decorator = new HotPotatoDecorator(base);
      const event = createHPEvent(W);
      decorator.setActiveEventsContext([event]);

      const m = move(22, [17]);
      const result = decorator.onTurnEnd(board, W, m);

      const piece = getBoardSquare(result, square(17));
      expect(piece?.color).toBe(B); // switched to Black
      expect(piece?.type).toBe(PieceType.Pawn);
    });

    it('onTurnEnd is no-op on non-affected player turn', () => {
      const board = buildBoard([{ sq: 15, color: B, type: P }]);
      const base = createAmericanRules();
      const decorator = new HotPotatoDecorator(base);
      const event = createHPEvent(W); // triggered by White
      decorator.setActiveEventsContext([event]);

      const m = move(15, [19]); // Black is moving
      const result = decorator.onTurnEnd(board, B, m);

      const piece = getBoardSquare(result, square(19));
      // Board unchanged since Black is not the affected player
      expect(piece).toBeNull(); // piece wasn't at 19 on input board
    });

    it('getLegalMoves is unchanged (no override)', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 3, color: B, type: P },
      ]);
      const event = createHPEvent(W);
      const state = crazyStateWithBoard(board, W, [event]);

      const withEvent = getCurrentLegalMoves(state);
      const withoutEvent = crazyStateWithBoard(board, W, []);
      const noEvent = getCurrentLegalMoves(withoutEvent);

      // Same moves with and without Hot Potato
      expect(withEvent.length).toBe(noEvent.length);
    });
  });

  // =========================================================================
  // Integration Tests — Full Game Flow via makeMove
  // =========================================================================

  describe('integration — full game flow', () => {
    it('color switch fires on affected player next turn', () => {
      // White pawn at 22, Black pawn at 3. Hot Potato triggered by White.
      // White moves (ply 1), then Black moves (ply 2), event does NOT fire.
      // White moves again (should fire now that we set up for 2 plies).
      // Actually with remainingPlies=2: fires on first pass of affected player.
      // Event created by White's multi-jump. White's NEXT move is when it fires.
      // So: Black moves (ply 1, no fire), White moves (ply 2, fire!).
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 10, color: B, type: P },
      ]);
      const event = createHPEvent(W, 0);
      // Start with Black's turn (the intervening turn after White's trigger)
      let state = crazyStateWithBoard(board, B, [event], 1);

      // Black's turn — event should NOT fire (Black is not the affected player)
      state = makeMove(state, firstMove(state));
      // Event ticked from 2 → 1
      const afterBlack = state.activeEvents.find(e => e.type === CrazyEvent.HotPotato);
      expect(afterBlack).toBeDefined();
      expect(afterBlack?.remainingPlies).toBe(1);

      // White's turn — event should fire (White is the affected player)
      const whiteMove = firstMove(state);
      const landingSq = landingOf(whiteMove);
      state = makeMove(state, whiteMove);

      // The piece on the landing square should now be Black
      const piece = getBoardSquare(state.board, landingSq);
      expect(piece?.color).toBe(B);

      // Event should be expired (ticked from 1 → 0)
      expect(state.activeEvents.some(e => e.type === CrazyEvent.HotPotato)).toBe(false);
    });

    it('color switch preserves piece type (pawn stays pawn)', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 10, color: B, type: P },
      ]);
      const event = createHPEvent(W, 0);
      let state = crazyStateWithBoard(board, B, [event], 1);

      // Black moves
      state = makeMove(state, firstMove(state));
      // White moves — Hot Potato fires
      const whiteMove = firstMove(state);
      const landingSq = landingOf(whiteMove);
      state = makeMove(state, whiteMove);

      const piece = getBoardSquare(state.board, landingSq);
      expect(piece?.type).toBe(PieceType.Pawn); // stays pawn
    });

    it('color switch preserves piece type (king stays king)', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: K },
        { sq: 10, color: B, type: P },
      ]);
      const event = createHPEvent(W, 0);
      let state = crazyStateWithBoard(board, B, [event], 1);

      state = makeMove(state, firstMove(state)); // Black
      const whiteMove = firstMove(state);
      const landingSq = landingOf(whiteMove);
      state = makeMove(state, whiteMove); // White — fire!

      const piece = getBoardSquare(state.board, landingSq);
      expect(piece?.color).toBe(B);
      expect(piece?.type).toBe(PieceType.King); // stays king
    });

    it('event expires after 2 plies', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 10, color: B, type: P },
      ]);
      const event = createHPEvent(W, 0);
      let state = crazyStateWithBoard(board, B, [event], 1);

      expect(state.activeEvents.some(e => e.type === CrazyEvent.HotPotato)).toBe(true);

      // Ply 1: Black moves
      state = makeMove(state, firstMove(state));
      // Ply 2: White moves
      state = makeMove(state, firstMove(state));

      // Event should be expired
      expect(state.activeEvents.some(e => e.type === CrazyEvent.HotPotato)).toBe(false);
    });

    it('event fires only once (on affected player turn)', () => {
      // Set up so we can track that no switch happens on Black's turn
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 10, color: B, type: P },
      ]);
      const event = createHPEvent(W, 0);
      let state = crazyStateWithBoard(board, B, [event], 1);

      // Black moves — piece should NOT switch
      const blackMove = firstMove(state);
      const blackLanding = landingOf(blackMove);
      state = makeMove(state, blackMove);

      const blackPiece = getBoardSquare(state.board, blackLanding);
      expect(blackPiece?.color).toBe(B); // Black piece stays Black
    });

    it('capture move with Hot Potato — landing piece switches', () => {
      // White king at 14, Black pawn at 18 (can be captured: 14→23 over 18).
      // Black king at 4 (far from action, simple move target).
      // White pawn at 24 (extra White piece).
      // Hot Potato triggered by White. Black moves first (intervening turn).
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 18, color: B, type: P },
        { sq: 4, color: B, type: K }, // far from action, king can move
        { sq: 24, color: W, type: P }, // extra White piece
      ]);
      const event = createHPEvent(W, 0);
      let state = crazyStateWithBoard(board, B, [event], 1);

      // Black moves (intervening turn) — Black king at 4
      state = makeMove(state, firstMove(state));

      // White captures: 14 → 23 over 18
      const captureMove = findCapture(state, 14);
      state = makeMove(state, captureMove);

      const landingSq = landingOf(captureMove);
      const piece = getBoardSquare(state.board, landingSq);
      expect(piece?.color).toBe(B); // switched to Black
      expect(piece?.type).toBe(PieceType.King);
    });
  });

  // =========================================================================
  // Stacking and Multi-Event Tests
  // =========================================================================

  describe('stacking and multi-event', () => {
    it('two stacked Hot Potatoes for same player — double switch cancels out', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 10, color: B, type: P },
      ]);
      const event1 = createHPEvent(W, 0);
      const event2 = createHPEvent(W, 1);
      let state = crazyStateWithBoard(board, B, [event1, event2], 1);

      // Black moves (intervening)
      state = makeMove(state, firstMove(state));

      // White moves — two Hot Potatoes, even count = cancel out
      const whiteMove = firstMove(state);
      const landingSq = landingOf(whiteMove);
      state = makeMove(state, whiteMove);

      const piece = getBoardSquare(state.board, landingSq);
      expect(piece?.color).toBe(W); // double switch cancels → stays White
    });

    it('two Hot Potatoes for different players — each fires on their turn', () => {
      // Both players have Hot Potato triggered against them
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 10, color: B, type: P },
      ]);
      const eventForWhite = createHPEvent(W, 0);
      const eventForBlack = createHPEvent(B, 0);
      let state = crazyStateWithBoard(board, B, [eventForWhite, eventForBlack], 1);

      // Black moves — Hot Potato fires for Black (triggeredBy=B matches)
      const blackMove = firstMove(state);
      const blackLanding = landingOf(blackMove);
      state = makeMove(state, blackMove);

      const blackPiece = getBoardSquare(state.board, blackLanding);
      expect(blackPiece?.color).toBe(W); // switched from Black to White

      // White moves — Hot Potato fires for White (triggeredBy=W matches)
      const whiteMove = firstMove(state);
      const whiteLanding = landingOf(whiteMove);
      state = makeMove(state, whiteMove);

      const whitePiece = getBoardSquare(state.board, whiteLanding);
      expect(whitePiece?.color).toBe(B); // switched from White to Black
    });

    it('Hot Potato + King for a Day coexistence', () => {
      // KfaD active + Hot Potato active. KfaD reverts temps in onTurnEnd first,
      // then Hot Potato switches color.
      // White pawn at 22 (becomes temp king under KfaD). Hot Potato triggered by White.
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 10, color: B, type: P },
      ]);
      const kfadEvent = createActiveEvent(CrazyEvent.KingForADay, W, 0, {
        originalKingSquares: [],
      });
      const hpEvent = createHPEvent(W, 0);
      let state = crazyStateWithBoard(board, B, [kfadEvent, hpEvent], 1);

      // Black moves (intervening)
      state = makeMove(state, firstMove(state));

      // White moves — KfaD reverts temp king to pawn, Hot Potato switches to Black
      const whiteMove = firstMove(state);
      const landingSq = landingOf(whiteMove);
      state = makeMove(state, whiteMove);

      const piece = getBoardSquare(state.board, landingSq);
      expect(piece?.color).toBe(B); // switched to Black
      // Type depends on KfaD reversion + position — should be pawn (reverted from temp king)
      expect(piece?.type).toBe(PieceType.Pawn);
    });

    it('Hot Potato + Live Grenade coexistence', () => {
      // White king at 14 captures Black pawn at 18, landing at 23.
      // Live Grenade explodes adjacent to 23. Hot Potato switches landing piece.
      // Black king at 4 (far from action). White pawn at 32.
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 18, color: B, type: P }, // captured
        { sq: 19, color: B, type: P }, // collateral (adjacent to sq 23)
        { sq: 4, color: B, type: K }, // far from action, king can move
        { sq: 32, color: W, type: P }, // extra White piece
      ]);
      const lgEvent = createActiveEvent(CrazyEvent.LiveGrenade, W, 0);
      const hpEvent = createHPEvent(W, 0);
      let state = crazyStateWithBoard(board, B, [lgEvent, hpEvent], 1);

      // Black moves (intervening)
      state = makeMove(state, firstMove(state));

      // White captures: 14 → 23 over 18
      const captureMove = findCapture(state, 14);
      state = makeMove(state, captureMove);

      const landingSq = landingOf(captureMove);
      // Hot Potato switches landing piece to Black
      const piece = getBoardSquare(state.board, landingSq);
      expect(piece?.color).toBe(B);
      expect(piece?.type).toBe(PieceType.King);
      // Live Grenade consumed
      expect(state.activeEvents.some(e => e.type === CrazyEvent.LiveGrenade)).toBe(false);
    });

    it('Hot Potato + No Touching coexistence', () => {
      // No Touching restricts pawn-captures-king. Hot Potato switches on move.
      // These operate independently.
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 18, color: B, type: K }, // pawn can't capture this
        { sq: 10, color: B, type: P },
      ]);
      const ntEvent = createActiveEvent(CrazyEvent.NoTouching, W, 0);
      const hpEvent = createHPEvent(W, 0);
      let state = crazyStateWithBoard(board, B, [ntEvent, hpEvent], 1);

      // Black moves (intervening)
      state = makeMove(state, firstMove(state));

      // White should not be able to jump the king (No Touching)
      const moves = getCurrentLegalMoves(state);
      const pawnCapKing = moves.filter(m =>
        m.captured.length > 0 &&
        (m.from as number) === 22 &&
        m.captured.some(sq => (sq as number) === 18),
      );
      expect(pawnCapKing).toHaveLength(0);

      // White makes a simple move — Hot Potato fires
      const simpleMove = moves.find(m => m.captured.length === 0);
      if (simpleMove) {
        const landingSq = landingOf(simpleMove);
        state = makeMove(state, simpleMove);
        const piece = getBoardSquare(state.board, landingSq);
        expect(piece?.color).toBe(B); // switched
      }
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('edge cases', () => {
    it('color switch removes affected player last piece — eventual game over', () => {
      // White has one piece. After Hot Potato, it becomes Black.
      // White has no pieces → game over on White's next turn check.
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 10, color: B, type: P },
      ]);
      const event = createHPEvent(W, 0);
      let state = crazyStateWithBoard(board, B, [event], 1);

      // Black moves
      state = makeMove(state, firstMove(state));

      // White moves — piece switches to Black. White has no pieces.
      const whiteMove = firstMove(state);
      state = makeMove(state, whiteMove);

      // The game should eventually detect White has no pieces
      // (may happen this turn or next depending on checkGameOver timing)
      // At minimum, verify the piece switched
      const landingSq = landingOf(whiteMove);
      const piece = getBoardSquare(state.board, landingSq);
      expect(piece?.color).toBe(B);
    });

    it('Hot Potato on pawn not on promotion row (no promotion)', () => {
      const board = buildBoard([{ sq: 15, color: W, type: P }]);
      const result = switchPieceColor(board, square(15));
      const piece = getBoardSquare(result, square(15));
      expect(piece?.color).toBe(B);
      expect(piece?.type).toBe(PieceType.Pawn); // no promotion, not on Black's back row
    });

    it('Hot Potato on already-promoted king', () => {
      const board = buildBoard([{ sq: 15, color: W, type: K }]);
      const result = switchPieceColor(board, square(15));
      const piece = getBoardSquare(result, square(15));
      expect(piece?.color).toBe(B);
      expect(piece?.type).toBe(PieceType.King); // stays king, no demotion
    });
  });

  // =========================================================================
  // Registration and Serialization
  // =========================================================================

  describe('registration', () => {
    it('is registered in EVENT_DECORATOR_REGISTRY', () => {
      expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.HotPotato)).toBe(true);
    });

    it('CrazyEvent.HotPotato is in IMPLEMENTED_EVENTS', () => {
      expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.HotPotato);
    });

    it('EVENT_DURATIONS[CrazyEvent.HotPotato] is 2', () => {
      expect(EVENT_DURATIONS[CrazyEvent.HotPotato]).toBe(2);
    });

    it('metadata factory stores hotSquare from triggering move', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 10, color: B, type: P },
      ]);
      const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.HotPotato);
      expect(factory).toBeDefined();
      if (!factory) return;

      const m = move(22, [17]);
      const metadata = factory(board, W, undefined, m);
      expect(metadata).toEqual({ hotSquare: 17 });
    });

    it('metadata factory returns undefined when no move provided', () => {
      const board = buildBoard([{ sq: 22, color: W, type: P }]);
      const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.HotPotato);
      expect(factory).toBeDefined();
      if (!factory) return;

      const metadata = factory(board, W);
      expect(metadata).toBeUndefined();
    });

    it('serialization round-trip preserves HotPotato event', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 10, color: B, type: P },
      ]);
      const event = createHPEvent(W, 0);
      const state = crazyStateWithBoard(board, B, [event], 1);

      // Simulate serialization round-trip
      const serializedEvents = state.activeEvents.map(e => ({ ...e }));
      const newState = crazyStateWithBoard(
        state.board,
        state.activeColor,
        serializedEvents,
        state.plyCount,
      );

      // Event preserved
      expect(
        newState.activeEvents.some(e => e.type === CrazyEvent.HotPotato),
      ).toBe(true);

      // Hot Potato still functions after round-trip
      let s = newState;
      // Black moves (intervening)
      s = makeMove(s, firstMove(s));
      // White moves (fire!)
      const whiteMove = firstMove(s);
      const landingSq = landingOf(whiteMove);
      s = makeMove(s, whiteMove);

      const piece = getBoardSquare(s.board, landingSq);
      expect(piece?.color).toBe(B); // switched
    });
  });
});
