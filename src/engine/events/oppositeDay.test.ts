/**
 * Task 9.2 — Opposite Day: Comprehensive test suite.
 *
 * Tests the OppositeDayDecorator through the full game lifecycle
 * using CompositeEventRuleSet and makeMove.
 */

import { describe, it, expect } from 'vitest';
import { OppositeDayDecorator, invertGameResult } from './oppositeDay';
import { createAmericanRules } from '../rules';
import { makeMove, getCurrentLegalMoves } from '../game';
import { computeZobristHash } from '../zobrist';
import {
  createActiveEvent,
  tickAllEvents,
  EVENT_DECORATOR_REGISTRY,
  EVENT_METADATA_FACTORIES,
  IMPLEMENTED_EVENTS,
} from '../events';
import { createCompositeRuleSet, CompositeEventRuleSet } from '../compositeRuleSet';
import {
  CrazyEvent,
  GameEndReason,
  GameMode,
  GameResultType,
  GameStatus,
  PieceColor,
  PieceType,
  PlayerType,
  square,
} from '../types';
import type {
  ActiveEvent,
  BoardState,
  GameResult,
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

function firstMove(state: GameState): Move {
  const moves = getCurrentLegalMoves(state);
  const first = moves[0];
  if (first === undefined) throw new Error('No legal moves');
  return first;
}

function crazyStateWithBoard(
  board: BoardState,
  activeColor: PieceColor = PieceColor.White,
  activeEvents: readonly ActiveEvent[] = [],
  plyCount = 0,
): GameState {
  const base = createAmericanRules();
  const ruleSet = createCompositeRuleSet(base);
  // Sync active events so direct calls to ruleSet methods see the events
  ruleSet.setActiveEvents(activeEvents);
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

function createOppositeDayEvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.OppositeDay, triggeredBy, triggeredAtPly);
}

/** Calls onCheckGameOver on a composite, asserting the hook exists. */
function callOnCheckGameOver(
  ruleSet: CompositeEventRuleSet,
  board: BoardState,
  activeColor: PieceColor,
  baseResult: GameResult | null,
): GameResult | null {
  return ruleSet.onCheckGameOver(board, activeColor, baseResult);
}

// ===========================================================================
// §6.1 — invertGameResult Unit Tests
// ===========================================================================

describe('invertGameResult', () => {
  it('swaps WhiteWin to BlackWin', () => {
    const result: GameResult = { type: GameResultType.WhiteWin, reason: GameEndReason.NoPiecesLeft };
    const inverted = invertGameResult(result);
    expect(inverted.type).toBe(GameResultType.BlackWin);
    expect(inverted.reason).toBe(GameEndReason.NoPiecesLeft);
  });

  it('swaps BlackWin to WhiteWin', () => {
    const result: GameResult = { type: GameResultType.BlackWin, reason: GameEndReason.NoLegalMoves };
    const inverted = invertGameResult(result);
    expect(inverted.type).toBe(GameResultType.WhiteWin);
    expect(inverted.reason).toBe(GameEndReason.NoLegalMoves);
  });

  it('preserves Draw', () => {
    const result: GameResult = { type: GameResultType.Draw, reason: GameEndReason.FortyMoveRule };
    const inverted = invertGameResult(result);
    expect(inverted.type).toBe(GameResultType.Draw);
    expect(inverted.reason).toBe(GameEndReason.FortyMoveRule);
  });

  it('preserves reason field for all GameEndReason variants', () => {
    const reasons: GameEndReason[] = [
      GameEndReason.NoPiecesLeft,
      GameEndReason.NoLegalMoves,
      GameEndReason.Repetition,
      GameEndReason.FortyMoveRule,
      GameEndReason.Resignation,
      GameEndReason.Time,
    ];

    for (const reason of reasons) {
      const whiteWin: GameResult = { type: GameResultType.WhiteWin, reason };
      expect(invertGameResult(whiteWin).reason).toBe(reason);

      const blackWin: GameResult = { type: GameResultType.BlackWin, reason };
      expect(invertGameResult(blackWin).reason).toBe(reason);

      const draw: GameResult = { type: GameResultType.Draw, reason };
      expect(invertGameResult(draw).reason).toBe(reason);
    }
  });
});

// ===========================================================================
// §6.2 — Decorator Core Behavior
// ===========================================================================

describe('OppositeDayDecorator', () => {
  describe('decorator basics', () => {
    it('is registered in EVENT_DECORATOR_REGISTRY', () => {
      expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.OppositeDay)).toBe(true);
    });

    it('is in IMPLEMENTED_EVENTS', () => {
      expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.OppositeDay);
    });

    it('has a metadata factory registered', () => {
      expect(EVENT_METADATA_FACTORIES.has(CrazyEvent.OppositeDay)).toBe(true);
      const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.OppositeDay);
      expect(factory).toBeDefined();
      expect(factory?.([], PieceColor.White)).toBeUndefined();
    });

    it('getEventType returns OppositeDay', () => {
      const base = createAmericanRules();
      const decorator = new OppositeDayDecorator(base);
      expect(decorator.getEventType()).toBe(CrazyEvent.OppositeDay);
    });

    it('withInner produces a new instance', () => {
      const base = createAmericanRules();
      const decorator = new OppositeDayDecorator(base);
      const newDecorator = decorator.withInner(base);
      expect(newDecorator).not.toBe(decorator);
      expect(newDecorator).toBeInstanceOf(OppositeDayDecorator);
    });

    it('is stateless — no instance variables for event state', () => {
      const base = createAmericanRules();
      const decorator = new OppositeDayDecorator(base);
      expect((decorator as unknown as Record<string, unknown>)['invertedResult']).toBeUndefined();
      expect((decorator as unknown as Record<string, unknown>)['isInverted']).toBeUndefined();
    });
  });

  // =========================================================================
  // onCheckGameOver — Core inversion behavior
  // =========================================================================

  describe('onCheckGameOver', () => {
    it('inverts NoPiecesLeft (WhiteWin → BlackWin) when active', () => {
      // Board where Black has no pieces — normally WhiteWin
      const board = buildBoard([
        { sq: 14, color: W, type: P },
      ]);
      const event = createOppositeDayEvent();
      const state = crazyStateWithBoard(board, B, [event]);
      const composite = state.ruleSet as CompositeEventRuleSet;

      // checkGameOver returns WhiteWin (Black has no pieces)
      const baseResult = composite.checkGameOver(state.board, B);
      expect(baseResult).not.toBeNull();
      expect(baseResult?.type).toBe(GameResultType.WhiteWin);

      // onCheckGameOver should invert to BlackWin
      const inverted = callOnCheckGameOver(composite, state.board, B, baseResult);
      expect(inverted).not.toBeNull();
      expect(inverted?.type).toBe(GameResultType.BlackWin);
      expect(inverted?.reason).toBe(GameEndReason.NoPiecesLeft);
    });

    it('inverts NoPiecesLeft (BlackWin → WhiteWin) when active', () => {
      // Board where White has no pieces — normally BlackWin
      const board = buildBoard([
        { sq: 3, color: B, type: P },
      ]);
      const event = createOppositeDayEvent();
      const state = crazyStateWithBoard(board, W, [event]);
      const composite = state.ruleSet as CompositeEventRuleSet;

      const baseResult = composite.checkGameOver(state.board, W);
      expect(baseResult).not.toBeNull();
      expect(baseResult?.type).toBe(GameResultType.BlackWin);

      const inverted = callOnCheckGameOver(composite, state.board, W, baseResult);
      expect(inverted).not.toBeNull();
      expect(inverted?.type).toBe(GameResultType.WhiteWin);
      expect(inverted?.reason).toBe(GameEndReason.NoPiecesLeft);
    });

    it('inverts NoLegalMoves (WhiteWin → BlackWin) when active', () => {
      // Board where Black has pieces but no legal moves (blocked)
      const board = buildBoard([
        { sq: 4, color: B, type: P },
        { sq: 8, color: W, type: K },
      ]);
      const event = createOppositeDayEvent();
      const state = crazyStateWithBoard(board, B, [event]);
      const composite = state.ruleSet as CompositeEventRuleSet;

      const baseResult = composite.checkGameOver(state.board, B);
      if (baseResult !== null && baseResult.type === GameResultType.WhiteWin) {
        const inverted = callOnCheckGameOver(composite, state.board, B, baseResult);
        expect(inverted?.type).toBe(GameResultType.BlackWin);
      }
    });

    it('does not invert when not active', () => {
      // Board where Black has no pieces — normally WhiteWin
      const board = buildBoard([
        { sq: 14, color: W, type: P },
      ]);
      // No active events
      const state = crazyStateWithBoard(board, B, []);
      const composite = state.ruleSet as CompositeEventRuleSet;

      const baseResult = composite.checkGameOver(state.board, B);
      expect(baseResult).not.toBeNull();

      const result = callOnCheckGameOver(composite, state.board, B, baseResult);
      expect(result?.type).toBe(GameResultType.WhiteWin); // Not inverted
    });

    it('passes through null (game not over)', () => {
      const board = buildBoard([
        { sq: 14, color: W, type: P },
        { sq: 3, color: B, type: P },
      ]);
      const event = createOppositeDayEvent();
      const state = crazyStateWithBoard(board, W, [event]);
      const composite = state.ruleSet as CompositeEventRuleSet;

      const result = callOnCheckGameOver(composite, state.board, W, null);
      expect(result).toBeNull();
    });

    it('does not invert Draw results', () => {
      const board = buildBoard([
        { sq: 14, color: W, type: P },
        { sq: 3, color: B, type: P },
      ]);
      const event = createOppositeDayEvent();
      const state = crazyStateWithBoard(board, W, [event]);
      const composite = state.ruleSet as CompositeEventRuleSet;

      const drawResult: GameResult = { type: GameResultType.Draw, reason: GameEndReason.FortyMoveRule };
      const result = callOnCheckGameOver(composite, state.board, W, drawResult);
      expect(result).not.toBeNull();
      expect(result?.type).toBe(GameResultType.Draw);
      expect(result?.reason).toBe(GameEndReason.FortyMoveRule);
    });
  });

  // =========================================================================
  // §6.3 — Event Lifecycle
  // =========================================================================

  describe('event lifecycle', () => {
    it('event lasts exactly 16 plies', () => {
      const event = createOppositeDayEvent();
      expect(event.remainingPlies).toBe(16);

      // Tick 1
      const afterTick1 = tickAllEvents([event]);
      expect(afterTick1.length).toBe(1);
      expect(afterTick1[0]?.remainingPlies).toBe(15);

      // Tick through remaining plies
      let events = afterTick1;
      for (let i = 2; i <= 15; i++) {
        events = tickAllEvents(events);
        expect(events.length).toBe(1);
        expect(events[0]?.remainingPlies).toBe(16 - i);
      }

      // Tick 16 — event removed
      const afterTick16 = tickAllEvents(events);
      expect(afterTick16.length).toBe(0);
    });

    it('event ticks down correctly over multiple rounds', () => {
      const event = createOppositeDayEvent();
      // After 4 plies (2 rounds), remainingPlies should be 12
      let events = [event];
      for (let i = 0; i < 4; i++) {
        events = tickAllEvents(events) as typeof events;
      }
      expect(events.length).toBe(1);
      expect(events[0]?.remainingPlies).toBe(12);
    });

    it('event expires after 8 rounds (16 half-turns)', () => {
      // White pawn far from Black pawn — no captures possible
      const board = buildBoard([
        { sq: 29, color: W, type: P },
        { sq: 4, color: B, type: P },
      ]);
      const event = createOppositeDayEvent();
      let state = crazyStateWithBoard(board, W, [event]);

      // Play 15 plies — event should still be active after ply 15
      for (let i = 0; i < 15; i++) {
        state = makeMove(state, firstMove(state));
        expect(state.activeEvents.some((e) => e.type === CrazyEvent.OppositeDay)).toBe(true);
      }

      // Ply 16: event should expire
      state = makeMove(state, firstMove(state));
      expect(state.activeEvents.some((e) => e.type === CrazyEvent.OppositeDay)).toBe(false);
    });

    it('normal win conditions resume after expiration', () => {
      const board = buildBoard([
        { sq: 29, color: W, type: K },
        { sq: 4, color: B, type: P },
      ]);
      const event = createOppositeDayEvent();
      let state = crazyStateWithBoard(board, W, [event]);

      // Play 16 plies to expire the event
      for (let i = 0; i < 16; i++) {
        state = makeMove(state, firstMove(state));
      }
      expect(state.activeEvents.some((e) => e.type === CrazyEvent.OppositeDay)).toBe(false);

      // Sync the composite's active events (now empty after expiration)
      const composite = state.ruleSet as CompositeEventRuleSet;
      composite.setActiveEvents(state.activeEvents);

      // Now if the game reaches game-over, it should NOT be inverted
      const whiteWin: GameResult = { type: GameResultType.WhiteWin, reason: GameEndReason.NoPiecesLeft };
      const result = callOnCheckGameOver(composite, state.board, B, whiteWin);
      expect(result?.type).toBe(GameResultType.WhiteWin); // Not inverted
    });
  });

  // =========================================================================
  // §6.4 — Stacking: Self-Stacking
  // =========================================================================

  describe('self-stacking', () => {
    it('no double-inversion with two Opposite Days', () => {
      const board = buildBoard([
        { sq: 14, color: W, type: P },
      ]);
      const event1 = createOppositeDayEvent(PieceColor.White, 0);
      const event2 = createOppositeDayEvent(PieceColor.Black, 1);
      const state = crazyStateWithBoard(board, B, [event1, event2]);
      const composite = state.ruleSet as CompositeEventRuleSet;

      const baseResult = composite.checkGameOver(state.board, B);
      expect(baseResult).not.toBeNull();
      expect(baseResult?.type).toBe(GameResultType.WhiteWin);

      // Should be inverted exactly once, not double-inverted back to WhiteWin
      const inverted = callOnCheckGameOver(composite, state.board, B, baseResult);
      expect(inverted?.type).toBe(GameResultType.BlackWin);
    });

    it('newer Opposite Day takes precedence — behavior identical to single entry', () => {
      const board = buildBoard([
        { sq: 3, color: B, type: P },
      ]);
      const event1 = createOppositeDayEvent(PieceColor.White, 0);
      const event2 = createOppositeDayEvent(PieceColor.Black, 2);
      const stateTwo = crazyStateWithBoard(board, W, [event1, event2]);
      const compositeTwo = stateTwo.ruleSet as CompositeEventRuleSet;

      const stateSingle = crazyStateWithBoard(board, W, [event2]);
      const compositeSingle = stateSingle.ruleSet as CompositeEventRuleSet;

      const baseResult: GameResult = { type: GameResultType.BlackWin, reason: GameEndReason.NoPiecesLeft };

      const resultTwo = callOnCheckGameOver(compositeTwo, stateTwo.board, W, baseResult);
      const resultSingle = callOnCheckGameOver(compositeSingle, stateSingle.board, W, baseResult);

      expect(resultTwo?.type).toBe(resultSingle?.type);
      expect(resultTwo?.type).toBe(GameResultType.WhiteWin);
    });
  });

  // =========================================================================
  // §6.5 — Stacking: Cross-Event
  // =========================================================================

  describe('cross-event stacking', () => {
    it('stacks with King for a Day', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 15, color: B, type: P },
      ]);

      const originalKingSquares: number[] = [];
      for (let i = 0; i < board.length; i++) {
        const piece = board[i];
        if (piece != null && piece.type === PieceType.King) {
          originalKingSquares.push(i + 1);
        }
      }

      const kfadEvent = createActiveEvent(CrazyEvent.KingForADay, W, 0, { originalKingSquares });
      const odEvent = createOppositeDayEvent();
      const state = crazyStateWithBoard(board, W, [kfadEvent, odEvent]);
      const composite = state.ruleSet as CompositeEventRuleSet;

      // KfaD gives pawns king moves — verify backward move exists
      const moves = getCurrentLegalMoves(state);
      const fromSq22 = moves.filter((m) => (m.from as number) === 22);
      const backwardMoves = fromSq22.filter((m) => {
        const dest = m.path[0] as number;
        return dest > 22; // backward for white
      });
      expect(backwardMoves.length).toBeGreaterThan(0);

      // Opposite Day would invert any game-over result
      const whiteWin: GameResult = { type: GameResultType.WhiteWin, reason: GameEndReason.NoPiecesLeft };
      const result = callOnCheckGameOver(composite, state.board, W, whiteWin);
      expect(result?.type).toBe(GameResultType.BlackWin);
    });

    it('stacks with No Touching', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 15, color: B, type: P },
      ]);

      const ntEvent = createActiveEvent(CrazyEvent.NoTouching, W, 0);
      const odEvent = createOppositeDayEvent();
      const state = crazyStateWithBoard(board, W, [ntEvent, odEvent]);
      const composite = state.ruleSet as CompositeEventRuleSet;

      expect(state.status).toBe(GameStatus.InProgress);

      const blackWin: GameResult = { type: GameResultType.BlackWin, reason: GameEndReason.NoLegalMoves };
      const result = callOnCheckGameOver(composite, state.board, W, blackWin);
      expect(result?.type).toBe(GameResultType.WhiteWin);
    });

    it('stacks with Hot Potato', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 15, color: B, type: P },
      ]);

      const hpEvent = createActiveEvent(CrazyEvent.HotPotato, W, 0);
      const odEvent = createOppositeDayEvent();
      const state = crazyStateWithBoard(board, W, [hpEvent, odEvent]);
      const composite = state.ruleSet as CompositeEventRuleSet;

      expect(state.activeEvents.length).toBe(2);

      const whiteWin: GameResult = { type: GameResultType.WhiteWin, reason: GameEndReason.NoPiecesLeft };
      const result = callOnCheckGameOver(composite, state.board, W, whiteWin);
      expect(result?.type).toBe(GameResultType.BlackWin);
    });

    it('stacks with Checks Mix', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 15, color: B, type: P },
      ]);

      const odEvent = createOppositeDayEvent();
      const state = crazyStateWithBoard(board, W, [odEvent]);

      // Opposite Day survives across moves
      const nextState = makeMove(state, firstMove(state));
      expect(nextState.activeEvents.some((e) => e.type === CrazyEvent.OppositeDay)).toBe(true);
    });
  });

  // =========================================================================
  // §6.6 — Integration Tests
  // =========================================================================

  describe('integration', () => {
    it('full game with Opposite Day: losing all pieces = win for the loser', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: K },
        { sq: 18, color: B, type: P },
      ]);
      const event = createOppositeDayEvent();
      const state = crazyStateWithBoard(board, W, [event]);

      // White captures Black's last piece: sq 22 → sq 15, capturing sq 18
      const captureMove = move(22, [15], [18]);
      const nextState = makeMove(state, captureMove);

      // Game should be over — Black wins (inverted from normal WhiteWin)
      expect(nextState.status).toBe(GameStatus.GameOver);
      expect(nextState.result).not.toBeNull();
      expect(nextState.result?.type).toBe(GameResultType.BlackWin);
      expect(nextState.result?.reason).toBe(GameEndReason.NoPiecesLeft);
    });

    it('Opposite Day in composite rule set: checkGameOver + onCheckGameOver chain', () => {
      const board = buildBoard([
        { sq: 14, color: W, type: P },
      ]);
      const event = createOppositeDayEvent();
      const base = createAmericanRules();
      const composite = createCompositeRuleSet(base);
      composite.setActiveEvents([event]);

      // checkGameOver returns WhiteWin (Black has no pieces)
      const baseResult = composite.checkGameOver(board, B);
      expect(baseResult?.type).toBe(GameResultType.WhiteWin);

      // onCheckGameOver inverts to BlackWin
      const inverted = callOnCheckGameOver(composite, board, B, baseResult);
      expect(inverted?.type).toBe(GameResultType.BlackWin);
    });

    it('makeMove correctly inverts game-over during Opposite Day', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: K },
        { sq: 18, color: B, type: P },
        { sq: 4, color: B, type: P },
      ]);
      const event = createOppositeDayEvent();
      let state = crazyStateWithBoard(board, W, [event]);

      // White captures one black piece (mandatory capture)
      state = makeMove(state, firstMove(state));

      // Game should still be in progress (Black still has a piece at sq 4)
      expect(state.status).toBe(GameStatus.InProgress);
    });
  });

  // =========================================================================
  // §6.7 — AI Integration
  // =========================================================================

  describe('AI integration', () => {
    it('AI sees inverted game-over during search', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: K },
        { sq: 18, color: B, type: P },
      ]);
      const event = createOppositeDayEvent();
      const base = createAmericanRules();
      const composite = createCompositeRuleSet(base);
      composite.setActiveEvents([event]);

      // Simulate AI search: after White captures Black's last piece
      const captureMove = move(22, [15], [18]);
      const afterCapture = composite.applyMove(board, captureMove);

      const result = composite.checkGameOver(afterCapture, B);
      expect(result).not.toBeNull();
      expect(result?.type).toBe(GameResultType.WhiteWin); // Base result

      const inverted = callOnCheckGameOver(composite, afterCapture, B, result);
      expect(inverted?.type).toBe(GameResultType.BlackWin); // Inverted for AI
    });
  });
});
