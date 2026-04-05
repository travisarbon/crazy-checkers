import { describe, it, expect } from 'vitest';
import { createNewGame, makeMove } from '../engine/game';
import { createAmericanRules } from '../engine/rules';
import { createInitialBoard } from '../engine/board';
import { CrazyEvent, GameMode, PlayerType, GameStatus, PieceColor, square } from '../engine/types';
import type { ActiveEvent, GameState, BoardState, Piece } from '../engine/types';
import { serializeGameState, deserializeGameState, serializeBoard } from './serialization';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestGame(): GameState {
  const ruleSet = createAmericanRules();
  const players = { white: PlayerType.Human, black: PlayerType.Human };
  return createNewGame(ruleSet, players);
}

function playMoves(state: GameState, count: number): GameState {
  let current = state;
  for (let i = 0; i < count; i++) {
    const moves = current.ruleSet.getLegalMoves(current.board, current.activeColor);
    if (moves.length === 0 || current.status !== GameStatus.InProgress) break;
    const move = moves[0];
    if (move === undefined) break;
    current = makeMove(current, move);
  }
  return current;
}

// ---------------------------------------------------------------------------
// Round-trip tests
// ---------------------------------------------------------------------------

describe('serializeGameState / deserializeGameState', () => {
  it('round-trips an initial game state', () => {
    const original = createTestGame();
    const restored = deserializeGameState(serializeGameState(original));

    expect(restored.board).toEqual(original.board);
    expect(restored.activeColor).toBe(original.activeColor);
    expect(restored.status).toBe(original.status);
    expect(restored.result).toEqual(original.result);
    expect(restored.players).toEqual(original.players);
    expect(restored.moveHistory).toEqual(original.moveHistory);
    expect(restored.positionHashes).toEqual(original.positionHashes);
    expect(restored.halfMoveClock).toBe(original.halfMoveClock);
    expect(restored.plyCount).toBe(original.plyCount);
  });

  it('round-trips a game after several moves', () => {
    const original = playMoves(createTestGame(), 8);
    const restored = deserializeGameState(serializeGameState(original));

    expect(restored.board).toEqual(original.board);
    expect(restored.activeColor).toBe(original.activeColor);
    expect(restored.moveHistory.length).toBe(original.moveHistory.length);
    expect(restored.positionHashes).toEqual(original.positionHashes);
    expect(restored.plyCount).toBe(original.plyCount);

    for (let i = 0; i < restored.moveHistory.length; i++) {
      const restoredMove = restored.moveHistory[i];
      const originalMove = original.moveHistory[i];
      if (restoredMove === undefined || originalMove === undefined) {
        throw new Error(`Missing move at index ${String(i)}`);
      }
      expect(restoredMove.from).toBe(originalMove.from);
      expect(restoredMove.path).toEqual(originalMove.path);
      expect(restoredMove.captured).toEqual(originalMove.captured);
    }
  });

  it('positionHashes survive round-trip as bigint', () => {
    const original = playMoves(createTestGame(), 4);
    expect(original.positionHashes.length).toBeGreaterThan(0);

    const restored = deserializeGameState(serializeGameState(original));
    for (let i = 0; i < original.positionHashes.length; i++) {
      expect(typeof restored.positionHashes[i]).toBe('bigint');
      expect(restored.positionHashes[i]).toBe(original.positionHashes[i]);
    }
  });

  it('move from and path elements pass the square() validator after round-trip', () => {
    const original = playMoves(createTestGame(), 4);
    const restored = deserializeGameState(serializeGameState(original));

    for (const move of restored.moveHistory) {
      expect(() => square(move.from as number)).not.toThrow();
      for (const sq of move.path) {
        expect(() => square(sq as number)).not.toThrow();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// serializeBoard tests
// ---------------------------------------------------------------------------

describe('serializeBoard', () => {
  it('produces a 32-character string', () => {
    const board = createInitialBoard();
    expect(serializeBoard(board)).toHaveLength(32);
  });

  it('encodes initial position correctly', () => {
    const board = createInitialBoard();
    const encoded = serializeBoard(board);

    // Squares 1-12 (indices 0-11): black pawns
    for (let i = 0; i < 12; i++) {
      expect(encoded[i]).toBe('b');
    }
    // Squares 13-20 (indices 12-19): empty
    for (let i = 12; i < 20; i++) {
      expect(encoded[i]).toBe('.');
    }
    // Squares 21-32 (indices 20-31): white pawns
    for (let i = 20; i < 32; i++) {
      expect(encoded[i]).toBe('w');
    }
  });

  it('handles kings correctly', () => {
    const board: BoardState = Array.from({ length: 32 }, () => null);
    const boardWithKing = [
      ...board.slice(0, 0),
      { color: 'WHITE', type: 'KING' } as Piece,
      ...board.slice(1, 5),
      { color: 'BLACK', type: 'KING' } as Piece,
      ...board.slice(6),
    ];
    const encoded = serializeBoard(boardWithKing);
    expect(encoded[0]).toBe('W');
    expect(encoded[5]).toBe('B');
    expect(encoded[1]).toBe('.');
  });
});

// ===========================================================================
// Crazy mode serialization
// ===========================================================================

describe('Crazy mode serialization', () => {
  it('round-trips a Crazy mode game with active events', () => {
    const state = createNewGame(
      createAmericanRules(),
      { white: PlayerType.Human, black: PlayerType.Human },
      GameMode.Crazy,
    );
    const stateWithEvent: GameState = {
      ...state,
      activeEvents: [
        {
          type: CrazyEvent.KingForADay,
          remainingPlies: 2,
          triggeredBy: PieceColor.White,
          triggeredAtPly: 5,
        },
      ],
    };

    const serialized = serializeGameState(stateWithEvent);
    const restored = deserializeGameState(serialized);

    expect(restored.mode).toBe(GameMode.Crazy);
    expect(restored.activeEvents.length).toBe(1);
    expect(restored.activeEvents[0]?.type).toBe(CrazyEvent.KingForADay);
    expect(restored.activeEvents[0]?.remainingPlies).toBe(2);
    expect('setActiveEvents' in restored.ruleSet).toBe(true);
  });

  it('deserializes Phase 1 saves with missing mode/activeEvents', () => {
    // Simulate a Phase 1 serialized state (no mode or activeEvents)
    const state = createTestGame();
    const serialized = serializeGameState(state);
    // Remove mode and activeEvents to simulate Phase 1 save
    const phase1Data = { ...serialized };
    delete phase1Data.mode;
    delete phase1Data.activeEvents;

    const restored = deserializeGameState(phase1Data);
    expect(restored.mode).toBe(GameMode.Classic);
    expect(restored.activeEvents).toEqual([]);
  });

  it('preserves event metadata through serialization', () => {
    const event: ActiveEvent = {
      type: CrazyEvent.KingForADay,
      remainingPlies: 2,
      triggeredBy: PieceColor.White,
      triggeredAtPly: 3,
      metadata: { originalKingSquares: [1, 3, 5] },
    };

    const state = createNewGame(
      createAmericanRules(),
      { white: PlayerType.Human, black: PlayerType.Human },
      GameMode.Crazy,
    );
    const stateWithEvent: GameState = { ...state, activeEvents: [event] };

    const serialized = serializeGameState(stateWithEvent);
    const restored = deserializeGameState(serialized);

    expect(restored.activeEvents[0]?.metadata).toEqual({ originalKingSquares: [1, 3, 5] });
  });

  it('Classic mode round-trip includes mode and activeEvents', () => {
    const state = createTestGame();
    const serialized = serializeGameState(state);
    const restored = deserializeGameState(serialized);

    expect(restored.mode).toBe(GameMode.Classic);
    expect(restored.activeEvents).toEqual([]);
    expect('setActiveEvents' in restored.ruleSet).toBe(false);
  });

  it('deserializes with unrecognized mode as Classic', () => {
    const state = createTestGame();
    const serialized = serializeGameState(state);
    // Set an invalid mode
    (serialized as unknown as Record<string, unknown>).mode = 'UNKNOWN_MODE';

    const restored = deserializeGameState(serialized);
    expect(restored.mode).toBe(GameMode.Classic);
  });

  it('round-trips a Choice mode game with CompositeEventRuleSet', () => {
    const state = createNewGame(
      createAmericanRules(),
      { white: PlayerType.Human, black: PlayerType.Human },
      GameMode.Choice,
    );
    const stateWithEvent: GameState = {
      ...state,
      activeEvents: [
        {
          type: CrazyEvent.OppositeDay,
          remainingPlies: 16,
          triggeredBy: PieceColor.White,
          triggeredAtPly: 0,
        },
      ],
    };

    const serialized = serializeGameState(stateWithEvent);
    const restored = deserializeGameState(serialized);

    expect(restored.mode).toBe(GameMode.Choice);
    expect(restored.activeEvents.length).toBe(1);
    expect('setActiveEvents' in restored.ruleSet).toBe(true);
  });

  it('round-trips a Chaos mode game with CompositeEventRuleSet', () => {
    const state = createNewGame(
      createAmericanRules(),
      { white: PlayerType.Human, black: PlayerType.Human },
      GameMode.Chaos,
    );

    const serialized = serializeGameState(state);
    const restored = deserializeGameState(serialized);

    expect(restored.mode).toBe(GameMode.Chaos);
    expect('setActiveEvents' in restored.ruleSet).toBe(true);
  });

  it('filters out malformed event entries during deserialization', () => {
    const state = createNewGame(
      createAmericanRules(),
      { white: PlayerType.Human, black: PlayerType.Human },
      GameMode.Crazy,
    );
    const serialized = serializeGameState(state);
    // Add malformed events (missing required fields)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (serialized as any).activeEvents = [
      { type: CrazyEvent.KingForADay, remainingPlies: 2, triggeredBy: PieceColor.White, triggeredAtPly: 5 },
      { type: null, remainingPlies: 2, triggeredBy: PieceColor.White, triggeredAtPly: 3 },
      { type: CrazyEvent.LiveGrenade },
    ];

    const restored = deserializeGameState(serialized);
    // Only the first valid event should survive
    expect(restored.activeEvents.length).toBe(1);
    expect(restored.activeEvents[0]?.type).toBe(CrazyEvent.KingForADay);
  });
});
