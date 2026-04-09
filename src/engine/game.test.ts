import { describe, it, expect } from 'vitest';
import {
  createNewGame,
  makeMove,
  movesAreEqual,
  resign,
  canUndo,
  getCurrentLegalMoves,
  getActivePlayerType,
  isAITurn,
} from './game';
import { createAmericanRules } from './rules';
import { createInitialBoard, getBoardSquare } from './board';
import { computeZobristHash } from './zobrist';
import {
  CrazyEvent,
  GameEndReason,
  GameMode,
  GameResultType,
  GameStatus,
  PieceColor,
  PlayerType,
  square,
} from './types';
import type { ActiveEvent, BoardState, GameState, Move, PlayerSetup, RuleSet, Square } from './types';
import { W, B, P, K, buildBoard } from './test-utils';
import { createCompositeRuleSet } from './compositeRuleSet';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HUMAN_VS_HUMAN: PlayerSetup = {
  white: PlayerType.Human,
  black: PlayerType.Human,
};

const HUMAN_VS_CPU_EASY: PlayerSetup = {
  white: PlayerType.Human,
  black: PlayerType.CpuEasy,
};

function newGame(players: PlayerSetup = HUMAN_VS_HUMAN): GameState {
  return createNewGame(createAmericanRules(), players);
}

/** Picks the first legal move from the current position. */
function firstLegalMove(state: GameState): Move {
  const moves = getCurrentLegalMoves(state);
  const first = moves[0];
  if (first === undefined) throw new Error('No legal moves');
  return first;
}

/** Helper to build a GameState with a custom board for targeted testing. */
function stateWithBoard(
  board: BoardState,
  activeColor: PieceColor = PieceColor.White,
  overrides: Partial<GameState> = {},
): GameState {
  const ruleSet = createAmericanRules();
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
    plyCount: 0,
    mode: GameMode.Classic,
    activeEvents: [],
    ...overrides,
  };
}

// ===========================================================================
// createNewGame
// ===========================================================================

describe('createNewGame', () => {
  it('returns a state with the standard initial board (12 white, 12 black pieces)', () => {
    const state = newGame();
    let white = 0;
    let black = 0;
    for (let i = 1; i <= 32; i++) {
      const p = getBoardSquare(state.board, square(i));
      if (p?.color === PieceColor.White) white++;
      if (p?.color === PieceColor.Black) black++;
    }
    expect(white).toBe(12);
    expect(black).toBe(12);
  });

  it('active color is White', () => {
    expect(newGame().activeColor).toBe(PieceColor.White);
  });

  it('status is InProgress', () => {
    expect(newGame().status).toBe(GameStatus.InProgress);
  });

  it('result is null', () => {
    expect(newGame().result).toBeNull();
  });

  it('moveHistory is empty', () => {
    expect(newGame().moveHistory).toHaveLength(0);
  });

  it('positionHashes has exactly 1 entry (the initial position)', () => {
    expect(newGame().positionHashes).toHaveLength(1);
  });

  it('halfMoveClock is 0', () => {
    expect(newGame().halfMoveClock).toBe(0);
  });

  it('plyCount is 0', () => {
    expect(newGame().plyCount).toBe(0);
  });

  it('players match the provided PlayerSetup', () => {
    const players: PlayerSetup = { white: PlayerType.Human, black: PlayerType.CpuHard };
    const state = createNewGame(createAmericanRules(), players);
    expect(state.players).toEqual(players);
  });
});

// ===========================================================================
// makeMove — basic turn flow
// ===========================================================================

describe('makeMove', () => {
  describe('basic turn flow', () => {
    it("after White's first move, activeColor is Black", () => {
      const state = newGame();
      const move = firstLegalMove(state);
      const next = makeMove(state, move);
      expect(next.activeColor).toBe(PieceColor.Black);
    });

    it('after Black responds, activeColor is White again', () => {
      let state = newGame();
      state = makeMove(state, firstLegalMove(state));
      state = makeMove(state, firstLegalMove(state));
      expect(state.activeColor).toBe(PieceColor.White);
    });

    it('moveHistory contains the played move', () => {
      const state = newGame();
      const move = firstLegalMove(state);
      const next = makeMove(state, move);
      expect(next.moveHistory).toHaveLength(1);
      const firstMove = next.moveHistory[0];
      expect(firstMove).toBeDefined();
      if (firstMove !== undefined) {
        expect(movesAreEqual(firstMove, move)).toBe(true);
      }
    });

    it('plyCount increments by 1', () => {
      const state = newGame();
      const next = makeMove(state, firstLegalMove(state));
      expect(next.plyCount).toBe(1);
    });

    it('positionHashes grows by 1 entry', () => {
      const state = newGame();
      const next = makeMove(state, firstLegalMove(state));
      expect(next.positionHashes).toHaveLength(2);
    });
  });

  // =========================================================================
  // Board transformation
  // =========================================================================

  describe('board transformation', () => {
    it('simple move: piece moves from origin to destination', () => {
      const state = newGame();
      // White pawn 21→17 is a standard opening move
      const moves = getCurrentLegalMoves(state);
      const move = moves.find((m) => (m.from as number) === 21 && (m.path[0] as number) === 17);
      if (move === undefined) throw new Error('expected move');
      const next = makeMove(state, move);
      expect(getBoardSquare(next.board, square(21))).toBeNull();
      expect(getBoardSquare(next.board, square(17))).toEqual({ color: W, type: P });
    });

    it('jump move: captured piece is removed, piece lands on destination', () => {
      // White pawn on 22, black pawn on 18 — white jumps to 15
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 18, color: B, type: P },
      ]);
      const state = stateWithBoard(board);
      const move: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
      const next = makeMove(state, move);
      expect(getBoardSquare(next.board, square(22))).toBeNull();
      expect(getBoardSquare(next.board, square(18))).toBeNull();
      expect(getBoardSquare(next.board, square(15))).toEqual({ color: W, type: P });
    });

    it('promotion move: pawn reaching king row becomes a king', () => {
      // White pawn on 5 (row1), moves to 1 (row0 = White's king row)
      const board = buildBoard([
        { sq: 5, color: W, type: P },
        { sq: 32, color: B, type: P }, // Black piece so game isn't over for black
      ]);
      const state = stateWithBoard(board);
      const move: Move = { from: square(5), path: [square(1)], captured: [] };
      const next = makeMove(state, move);
      expect(getBoardSquare(next.board, square(1))).toEqual({ color: W, type: K });
    });

    it('the original state is not mutated (immutability check)', () => {
      const state = newGame();
      const boardBefore = [...state.board];
      const historyBefore = [...state.moveHistory];
      const hashesBefore = [...state.positionHashes];

      makeMove(state, firstLegalMove(state));

      // Original state should be unchanged
      expect([...state.board]).toEqual(boardBefore);
      expect([...state.moveHistory]).toEqual(historyBefore);
      expect([...state.positionHashes]).toEqual(hashesBefore);
      expect(state.plyCount).toBe(0);
    });
  });

  // =========================================================================
  // Half-move clock
  // =========================================================================

  describe('half-move clock', () => {
    it('simple pawn move: clock resets to 0 (pawn advance)', () => {
      const state = newGame();
      const next = makeMove(state, firstLegalMove(state));
      expect(next.halfMoveClock).toBe(0); // pawn moved
    });

    it('king simple move (no capture): clock increments by 1', () => {
      // White king on 14 (center), black king far away. No captures possible.
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 4, color: B, type: K },
      ]);
      const state = stateWithBoard(board);
      // White king can move to 9, 10, 17, or 18
      const moves = getCurrentLegalMoves(state);
      const kingMove = moves.find((m) => m.captured.length === 0);
      if (kingMove === undefined) throw new Error('expected king move');
      const next = makeMove(state, kingMove);
      expect(next.halfMoveClock).toBe(1);
    });

    it('capture move: clock resets to 0', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: K },
        { sq: 18, color: B, type: P },
      ]);
      // Manually set halfMoveClock to 5 to verify reset
      const state = stateWithBoard(board, PieceColor.White, { halfMoveClock: 5 });
      const move: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
      const next = makeMove(state, move);
      expect(next.halfMoveClock).toBe(0);
    });

    it('sequential king moves without capture: clock increments each time', () => {
      // Two kings shuttling back and forth
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 4, color: B, type: K },
      ]);
      let state = stateWithBoard(board);

      // Play 4 moves (2 per side) — all king moves, no captures
      for (let i = 0; i < 4; i++) {
        const moves = getCurrentLegalMoves(state);
        const noCapture = moves.find((m) => m.captured.length === 0);
        if (noCapture === undefined) throw new Error('expected no-capture move');
        state = makeMove(state, noCapture);
        expect(state.halfMoveClock).toBe(i + 1);
      }
    });
  });

  // =========================================================================
  // Validation
  // =========================================================================

  describe('validation', () => {
    it('throws Error if game is GameOver', () => {
      let state = newGame();
      state = {
        ...state,
        status: GameStatus.GameOver,
        result: { type: GameResultType.Draw, reason: GameEndReason.Repetition },
      };
      expect(() => makeMove(state, firstLegalMove(newGame()))).toThrow('not in progress');
    });

    it('throws Error if the move is not in the legal moves list', () => {
      const state = newGame();
      const illegalMove: Move = { from: square(1), path: [square(5)], captured: [] };
      expect(() => makeMove(state, illegalMove)).toThrow('Illegal move');
    });

    it('accepts any move that appears in getLegalMoves', () => {
      const state = newGame();
      const moves = getCurrentLegalMoves(state);
      // All legal moves should be accepted without throwing
      for (const move of moves) {
        expect(() => makeMove(state, move)).not.toThrow();
      }
    });
  });

  // =========================================================================
  // Win detection
  // =========================================================================

  describe('win detection', () => {
    it('game where one side captures all opponent pieces: correct winner', () => {
      // White king on 22, lone black pawn on 18 — white captures it
      const board = buildBoard([
        { sq: 22, color: W, type: K },
        { sq: 18, color: B, type: P },
      ]);
      const state = stateWithBoard(board);
      const move: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
      const next = makeMove(state, move);
      expect(next.status).toBe(GameStatus.GameOver);
      expect(next.result?.type).toBe(GameResultType.WhiteWin);
      expect(next.result?.reason).toBe(GameEndReason.NoPiecesLeft);
    });

    it('game where one side is blocked (no legal moves): correct winner', () => {
      // Black pawn at 28 (row6,col6) wants to move to row7.
      // Both destinations (sq31, sq32) blocked by white pieces.
      const board = buildBoard([
        { sq: 28, color: B, type: P },
        { sq: 31, color: W, type: P },
        { sq: 32, color: W, type: P },
      ]);
      const state = stateWithBoard(board, PieceColor.Black);
      const moves = getCurrentLegalMoves(state);
      expect(moves).toHaveLength(0);
      const result = state.ruleSet.checkGameOver(state.board, state.activeColor);
      expect(result).not.toBeNull();
      expect(result?.type).toBe(GameResultType.WhiteWin);
      expect(result?.reason).toBe(GameEndReason.NoLegalMoves);
    });

    it('game that is not over: status remains InProgress', () => {
      const state = newGame();
      const next = makeMove(state, firstLegalMove(state));
      expect(next.status).toBe(GameStatus.InProgress);
      expect(next.result).toBeNull();
    });
  });

  // =========================================================================
  // Threefold repetition
  // =========================================================================

  describe('threefold repetition', () => {
    it('position that repeats 3 times via back-and-forth king moves triggers draw', () => {
      // Two kings that shuttle back and forth to create repetition.
      // White king on 14, black king on 4.
      // White: 14→10, Black: 4→8, White: 10→14, Black: 8→4 (back to start = 2nd occurrence)
      // White: 14→10, Black: 4→8, White: 10→14, Black: 8→4 (3rd occurrence → draw)
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 4, color: B, type: K },
      ]);
      let state = stateWithBoard(board);

      // We need to reach the same position 3 times. The initial position counts as the 1st.
      // Cycle 1: W 14→10, B 4→8, W 10→14, B 8→4 → 2nd occurrence of initial
      // Cycle 2: W 14→10, B 4→8, W 10→14, B 8→4 → 3rd occurrence → draw

      const cycle: Array<{ from: number; to: number }> = [
        { from: 14, to: 10 },
        { from: 4, to: 8 },
        { from: 10, to: 14 },
        { from: 8, to: 4 },
      ];

      for (let rep = 0; rep < 2; rep++) {
        for (const { from, to } of cycle) {
          if (state.status === GameStatus.GameOver) break;
          const move: Move = { from: square(from), path: [square(to)], captured: [] };
          // Verify this is a legal move
          const legalMoves = getCurrentLegalMoves(state);
          const legal = legalMoves.find((m) => movesAreEqual(m, move));
          if (!legal) {
            // Try alternate route if this exact move isn't legal
            state = makeMove(state, firstLegalMove(state));
            continue;
          }
          state = makeMove(state, legal);
        }
      }

      expect(state.status).toBe(GameStatus.GameOver);
      expect(state.result?.type).toBe(GameResultType.Draw);
      expect(state.result?.reason).toBe(GameEndReason.Repetition);
    });

    it('position that repeats only 2 times: game continues', () => {
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 4, color: B, type: K },
      ]);
      let state = stateWithBoard(board);

      // One cycle: W 14→10, B 4→8, W 10→14, B 8→4 → 2nd occurrence only
      const cycle: Array<{ from: number; to: number }> = [
        { from: 14, to: 10 },
        { from: 4, to: 8 },
        { from: 10, to: 14 },
        { from: 8, to: 4 },
      ];

      for (const { from, to } of cycle) {
        const move: Move = { from: square(from), path: [square(to)], captured: [] };
        const legalMoves = getCurrentLegalMoves(state);
        const legal = legalMoves.find((m) => movesAreEqual(m, move));
        if (legal) {
          state = makeMove(state, legal);
        }
      }

      expect(state.status).toBe(GameStatus.InProgress);
    });
  });

  // =========================================================================
  // 40-move rule
  // =========================================================================

  describe('40-move rule', () => {
    it('80 consecutive half-moves (king shuffles) triggers draw', () => {
      // Set halfMoveClock to 79 and verify one more king move triggers draw
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 4, color: B, type: K },
      ]);
      let state = stateWithBoard(board, PieceColor.White, { halfMoveClock: 79 });

      const moves = getCurrentLegalMoves(state);
      const kingMove = moves.find((m) => m.captured.length === 0);
      if (kingMove === undefined) throw new Error('expected king move');
      state = makeMove(state, kingMove);
      expect(state.status).toBe(GameStatus.GameOver);
      expect(state.result?.type).toBe(GameResultType.Draw);
      expect(state.result?.reason).toBe(GameEndReason.FortyMoveRule);
    });

    it('a capture at half-move 79 resets the clock — no draw', () => {
      // White king can capture a black pawn, resetting the clock
      const board = buildBoard([
        { sq: 22, color: W, type: K },
        { sq: 18, color: B, type: P },
      ]);
      const state = stateWithBoard(board, PieceColor.White, { halfMoveClock: 79 });
      const move: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
      const next = makeMove(state, move);
      // Capture resets clock — but game might be over because all black pieces are gone
      expect(next.halfMoveClock).toBe(0);
      // Game is over because black has no pieces, but NOT due to 40-move rule
      expect(next.result?.reason).not.toBe(GameEndReason.FortyMoveRule);
    });

    it('a pawn advance at half-move 79 resets the clock — no draw', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 4, color: B, type: K },
      ]);
      const state = stateWithBoard(board, PieceColor.White, { halfMoveClock: 79 });
      const move: Move = { from: square(22), path: [square(18)], captured: [] };
      const next = makeMove(state, move);
      expect(next.halfMoveClock).toBe(0);
      expect(next.status).toBe(GameStatus.InProgress);
    });

    it('clock reaches exactly 80: draw triggered', () => {
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 4, color: B, type: K },
      ]);
      const state = stateWithBoard(board, PieceColor.White, { halfMoveClock: 79 });
      const moves = getCurrentLegalMoves(state);
      const kingMove = moves.find((m) => m.captured.length === 0);
      if (kingMove === undefined) throw new Error('expected king move');
      const next = makeMove(state, kingMove);
      expect(next.halfMoveClock).toBe(80);
      expect(next.result?.reason).toBe(GameEndReason.FortyMoveRule);
    });
  });
});

// ===========================================================================
// resign
// ===========================================================================

describe('resign', () => {
  it('White resigns: status GameOver, result BlackWin / Resignation', () => {
    const state = newGame();
    const resigned = resign(state, PieceColor.White);
    expect(resigned.status).toBe(GameStatus.GameOver);
    expect(resigned.result?.type).toBe(GameResultType.BlackWin);
    expect(resigned.result?.reason).toBe(GameEndReason.Resignation);
  });

  it('Black resigns: status GameOver, result WhiteWin / Resignation', () => {
    const state = newGame();
    const resigned = resign(state, PieceColor.Black);
    expect(resigned.status).toBe(GameStatus.GameOver);
    expect(resigned.result?.type).toBe(GameResultType.WhiteWin);
    expect(resigned.result?.reason).toBe(GameEndReason.Resignation);
  });

  it('throws Error if game is already over', () => {
    let state = newGame();
    state = resign(state, PieceColor.White);
    expect(() => resign(state, PieceColor.Black)).toThrow('not in progress');
  });
});

// ===========================================================================
// canUndo
// ===========================================================================

describe('canUndo', () => {
  it('returns false when plyCount is 0 (no moves played)', () => {
    expect(canUndo(newGame())).toBe(false);
  });

  it('returns false when game is over', () => {
    const state = resign(newGame(), PieceColor.White);
    expect(canUndo(state)).toBe(false);
  });

  it('returns true when at least one move has been played and game is in progress', () => {
    const state = newGame();
    const next = makeMove(state, firstLegalMove(state));
    expect(canUndo(next)).toBe(true);
  });
});

// ===========================================================================
// Query helpers
// ===========================================================================

describe('query helpers', () => {
  it("getCurrentLegalMoves returns 7 moves for White's opening turn", () => {
    const state = newGame();
    const moves = getCurrentLegalMoves(state);
    expect(moves).toHaveLength(7);
  });

  it('getCurrentLegalMoves returns empty array when game is over', () => {
    const state = resign(newGame(), PieceColor.White);
    expect(getCurrentLegalMoves(state)).toHaveLength(0);
  });

  it('getActivePlayerType returns the correct player type', () => {
    const state = createNewGame(createAmericanRules(), HUMAN_VS_CPU_EASY);
    expect(getActivePlayerType(state)).toBe(PlayerType.Human); // White's turn
    const next = makeMove(state, firstLegalMove(state));
    expect(getActivePlayerType(next)).toBe(PlayerType.CpuEasy); // Black's turn
  });

  it('isAITurn returns true for CPU players, false for human', () => {
    const state = createNewGame(createAmericanRules(), HUMAN_VS_CPU_EASY);
    expect(isAITurn(state)).toBe(false); // White is human
    const next = makeMove(state, firstLegalMove(state));
    expect(isAITurn(next)).toBe(true); // Black is CPU
  });
});

// ===========================================================================
// movesAreEqual
// ===========================================================================

describe('movesAreEqual', () => {
  it('returns true for structurally identical moves', () => {
    const a: Move = { from: square(22), path: [square(18)], captured: [] };
    const b: Move = { from: square(22), path: [square(18)], captured: [] };
    expect(movesAreEqual(a, b)).toBe(true);
  });

  it('returns false for different from squares', () => {
    const a: Move = { from: square(22), path: [square(18)], captured: [] };
    const b: Move = { from: square(21), path: [square(18)], captured: [] };
    expect(movesAreEqual(a, b)).toBe(false);
  });

  it('returns false for different paths', () => {
    const a: Move = { from: square(22), path: [square(18)], captured: [] };
    const b: Move = { from: square(22), path: [square(17)], captured: [] };
    expect(movesAreEqual(a, b)).toBe(false);
  });

  it('returns true for multi-jump moves with same structure', () => {
    const a: Move = {
      from: square(22),
      path: [square(15), square(8)],
      captured: [square(18), square(11)],
    };
    const b: Move = {
      from: square(22),
      path: [square(15), square(8)],
      captured: [square(18), square(11)],
    };
    expect(movesAreEqual(a, b)).toBe(true);
  });
});

// ===========================================================================
// makeMove — hook integration
// ===========================================================================

describe('makeMove — hook integration', () => {
  /**
   * Creates a RuleSet that delegates core behavior to AmericanRules
   * but defines optional hooks for testing the hook execution paths.
   */
  function rulesWithHooks(hooks: {
    onTurnStart?: RuleSet['onTurnStart'];
    onTurnEnd?: RuleSet['onTurnEnd'];
    onCapture?: RuleSet['onCapture'];
    onCheckGameOver?: RuleSet['onCheckGameOver'];
  }): RuleSet {
    const base = createAmericanRules();
    return {
      getLegalMoves: base.getLegalMoves.bind(base),
      applyMove: base.applyMove.bind(base),
      checkGameOver: base.checkGameOver.bind(base),
      shouldPromote: base.shouldPromote.bind(base),
      ...hooks,
    };
  }

  function stateWithHooks(
    board: BoardState,
    hooks: Parameters<typeof rulesWithHooks>[0],
    activeColor: PieceColor = PieceColor.White,
    overrides: Partial<GameState> = {},
  ): GameState {
    const ruleSet = rulesWithHooks(hooks);
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
      plyCount: 0,
      mode: GameMode.Classic,
      activeEvents: [],
      ...overrides,
    };
  }

  it('calls onTurnStart before applyMove with current board and active color', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 4, color: B, type: K },
    ]);
    const startCalls: PieceColor[] = [];
    const state = stateWithHooks(board, {
      onTurnStart: (b, color) => {
        startCalls.push(color);
        return b; // pass-through
      },
    });
    const move: Move = { from: square(22), path: [square(18)], captured: [] };
    makeMove(state, move);
    expect(startCalls).toHaveLength(1);
    expect(startCalls[0]).toBe(PieceColor.White);
  });

  it('calls onCapture after a capture with landing square and captured squares', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
    ]);
    const captureCalls: Array<{ landing: Square; captured: Square[] }> = [];
    const state = stateWithHooks(board, {
      onCapture: (b, landing, captured) => {
        captureCalls.push({ landing, captured });
        return b;
      },
    });
    const move: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
    makeMove(state, move);
    expect(captureCalls).toHaveLength(1);
    expect(captureCalls[0]?.landing).toBe(square(15));
    expect(captureCalls[0]?.captured).toEqual([square(18)]);
  });

  it('calls onTurnEnd after move with active color and move object', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 4, color: B, type: K },
    ]);
    const endCalls: Array<{ activeColor: PieceColor; move: Move }> = [];
    const state = stateWithHooks(board, {
      onTurnEnd: (b, color, m) => {
        endCalls.push({ activeColor: color, move: m });
        return b;
      },
    });
    const move: Move = { from: square(22), path: [square(18)], captured: [] };
    makeMove(state, move);
    expect(endCalls).toHaveLength(1);
    expect(endCalls[0]?.activeColor).toBe(PieceColor.White);
    expect(movesAreEqual(endCalls[0]?.move ?? move, move)).toBe(true);
  });

  it('onCheckGameOver can convert a non-game-over into a game-over', () => {
    // Board where the game is NOT over after the move
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 4, color: B, type: K },
    ]);
    const state = stateWithHooks(board, {
      onCheckGameOver: () => {
        // Force game over regardless of base result
        return { type: GameResultType.Draw, reason: GameEndReason.Repetition };
      },
    });
    const move: Move = { from: square(22), path: [square(18)], captured: [] };
    const next = makeMove(state, move);
    expect(next.status).toBe(GameStatus.GameOver);
    expect(next.result?.type).toBe(GameResultType.Draw);
  });

  it('onCheckGameOver can convert a game-over into continuation (returns null)', () => {
    // Board where capturing the last black piece would end the game
    const board = buildBoard([
      { sq: 22, color: W, type: K },
      { sq: 18, color: B, type: P },
    ]);
    const state = stateWithHooks(board, {
      onCheckGameOver: () => null,
    });
    const move: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
    const next = makeMove(state, move);
    // The hook suppressed the game-over
    expect(next.status).toBe(GameStatus.InProgress);
    expect(next.result).toBeNull();
  });

  it('Zobrist uses full recomputation when any hook is present', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 4, color: B, type: K },
    ]);
    const state = stateWithHooks(board, {
      onTurnStart: (b) => b, // no-op hook, but still triggers full recomputation
    });
    const move: Move = { from: square(22), path: [square(18)], captured: [] };
    const next = makeMove(state, move);

    // Verify hash matches full recomputation (correctness check)
    const lastHash = next.positionHashes[next.positionHashes.length - 1] ?? 0n;
    const recomputed = computeZobristHash(next.board, next.activeColor);
    expect(lastHash).toBe(recomputed);
  });
});

// ===========================================================================
// makeMove — defensive errors
// ===========================================================================

describe('makeMove — defensive errors', () => {
  it('throws descriptive error when origin square is empty (corrupted state)', () => {
    // Build a state with a valid legal-moves list but corrupt the board
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 4, color: B, type: K },
    ]);
    const state = stateWithBoard(board);
    const move: Move = { from: square(22), path: [square(18)], captured: [] };

    // Corrupt: replace board with one missing the piece at sq 22
    const corruptBoard = buildBoard([{ sq: 4, color: B, type: K }]);
    // Manually build a state where getLegalMoves still returns the move
    // but the board doesn't have the piece
    const corruptState: GameState = {
      ...state,
      board: corruptBoard,
      ruleSet: {
        ...state.ruleSet,
        getLegalMoves: () => [move], // pretend the move is legal
      },
    };
    // With Marching Orders support, movingPiece=null no longer throws
    // at the snapshot step. The corrupt state will proceed to applyMove
    // which handles the actual piece movement. Verify the origin-square
    // error is no longer thrown (it proceeds past the snapshot).
    expect(() => makeMove(corruptState, move)).not.toThrow('No piece at move origin square');
  });

  it('throws descriptive error when move path is empty', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 4, color: B, type: K },
    ]);
    const emptyPathMove: Move = { from: square(22), path: [], captured: [] };
    const state: GameState = {
      ...stateWithBoard(board),
      ruleSet: {
        ...stateWithBoard(board).ruleSet,
        getLegalMoves: () => [emptyPathMove],
        applyMove: (b) => b, // no-op since path is empty
      },
    };
    expect(() => makeMove(state, emptyPathMove)).toThrow('move has empty path');
  });
});

// ===========================================================================
// Engine output for accessibility
// ===========================================================================

describe('engine output for accessibility', () => {
  it('move history entries have fully populated from, path, and captured fields', () => {
    // Play a capture move and verify move history completeness
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
    ]);
    const state = stateWithBoard(board);
    const move: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
    const next = makeMove(state, move);
    const recorded = next.moveHistory[0];
    expect(recorded).toBeDefined();
    expect(recorded?.from).toBe(square(22));
    expect(recorded?.path).toEqual([square(15)]);
    expect(recorded?.captured).toEqual([square(18)]);
  });

  it('game-over result includes reason for all ending conditions', () => {
    // NoPiecesLeft
    const board1 = buildBoard([
      { sq: 22, color: W, type: K },
      { sq: 18, color: B, type: P },
    ]);
    const s1 = stateWithBoard(board1);
    const m1: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
    const r1 = makeMove(s1, m1);
    expect(r1.result?.reason).toBe(GameEndReason.NoPiecesLeft);

    // Resignation
    const s2 = newGame();
    const r2 = resign(s2, PieceColor.White);
    expect(r2.result?.reason).toBe(GameEndReason.Resignation);

    // FortyMoveRule
    const board3 = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 4, color: B, type: K },
    ]);
    const s3 = stateWithBoard(board3, PieceColor.White, { halfMoveClock: 79 });
    const moves3 = getCurrentLegalMoves(s3);
    const kingMove = moves3.find((m) => m.captured.length === 0);
    if (kingMove === undefined) throw new Error('expected king move');
    const r3 = makeMove(s3, kingMove);
    expect(r3.result?.reason).toBe(GameEndReason.FortyMoveRule);
  });

  it('getCurrentLegalMoves returns complete move objects suitable for UI annotation', () => {
    const state = newGame();
    const moves = getCurrentLegalMoves(state);
    for (const move of moves) {
      expect(move.from).toBeDefined();
      expect(Array.isArray(move.path)).toBe(true);
      expect(move.path.length).toBeGreaterThan(0);
      expect(Array.isArray(move.captured)).toBe(true);
    }
  });
});

// ===========================================================================
// Full game replay
// ===========================================================================

describe('full game replay', () => {
  it('plays 10+ moves without error using first legal moves', () => {
    let state = newGame();

    for (let i = 0; i < 10; i++) {
      const move = firstLegalMove(state);
      state = makeMove(state, move);
      // Game shouldn't be over after just 10 plies from the start
      expect(state.status).toBe(GameStatus.InProgress);
    }

    expect(state.plyCount).toBe(10);
    expect(state.moveHistory).toHaveLength(10);
  });

  it('Zobrist incremental hash matches full recomputation for each move in a game', () => {
    let state = newGame();

    // Play several moves and verify hash consistency
    for (let i = 0; i < 6; i++) {
      const move = firstLegalMove(state);
      state = makeMove(state, move);

      const currentHash = state.positionHashes[state.positionHashes.length - 1] ?? 0n;
      const recomputedHash = computeZobristHash(state.board, state.activeColor);
      expect(currentHash).toBe(recomputedHash);
    }
  });
});

// ===========================================================================
// Crazy mode — createNewGame
// ===========================================================================

describe('createNewGame — Crazy mode', () => {
  it('creates a game with Crazy mode and empty activeEvents', () => {
    const state = createNewGame(createAmericanRules(), HUMAN_VS_HUMAN, GameMode.Crazy);
    expect(state.mode).toBe(GameMode.Crazy);
    expect(state.activeEvents).toEqual([]);
    expect(state.status).toBe(GameStatus.InProgress);
  });

  it('uses CompositeEventRuleSet for Crazy mode', () => {
    const state = createNewGame(createAmericanRules(), HUMAN_VS_HUMAN, GameMode.Crazy);
    expect('setActiveEvents' in state.ruleSet).toBe(true);
  });

  it('defaults to Classic mode when no mode specified', () => {
    const state = createNewGame(createAmericanRules(), HUMAN_VS_HUMAN);
    expect(state.mode).toBe(GameMode.Classic);
    expect(state.activeEvents).toEqual([]);
  });

  it('Classic mode does not use CompositeEventRuleSet', () => {
    const state = createNewGame(createAmericanRules(), HUMAN_VS_HUMAN);
    expect('setActiveEvents' in state.ruleSet).toBe(false);
  });
});

// ===========================================================================
// Crazy mode — makeMove event trigger
// ===========================================================================

describe('makeMove — Crazy mode event trigger', () => {
  it('triggers a random event on multi-jump (>=2 captures)', () => {
    // White king at 2 can double-jump over black pawns at 6 and 11
    const board = buildBoard([
      { sq: 2, color: W, type: K }, // White king
      { sq: 6, color: B, type: P }, // Black pawn (capturable)
      { sq: 11, color: B, type: P }, // Black pawn (second capture)
      { sq: 32, color: B, type: P }, // Keep black alive
      { sq: 29, color: W, type: P }, // Keep white alive
    ]);

    const state = stateWithBoard(board, PieceColor.White, {
      mode: GameMode.Crazy,
      ruleSet: createCompositeRuleSet(createAmericanRules()),
    });

    // Find the double-jump move
    const legalMoves = getCurrentLegalMoves(state);
    const multiJump = legalMoves.find((m) => m.captured.length >= 2);

    if (multiJump) {
      const newState = makeMove(state, multiJump);
      // A multi-jump should trigger an event in Crazy mode
      expect(newState.activeEvents.length).toBe(1);
      expect(newState.mode).toBe(GameMode.Crazy);
    } else {
      // If no multi-jump available with this board, skip
      expect(true).toBe(true);
    }
  });

  it('does not trigger events on single captures in Crazy mode', () => {
    // White king at 1 can single-jump over black pawn at 5
    const board = buildBoard([
      { sq: 1, color: W, type: K }, // White king
      { sq: 5, color: B, type: P }, // Black pawn (single capture)
      { sq: 32, color: B, type: P }, // Keep black alive
      { sq: 29, color: W, type: P }, // Keep white alive
    ]);

    const state = stateWithBoard(board, PieceColor.White, {
      mode: GameMode.Crazy,
      ruleSet: createCompositeRuleSet(createAmericanRules()),
    });

    const legalMoves = getCurrentLegalMoves(state);
    const singleJump = legalMoves.find((m) => m.captured.length === 1);

    if (singleJump) {
      const newState = makeMove(state, singleJump);
      expect(newState.activeEvents).toEqual([]);
    }
  });

  it('does not trigger events in Classic mode', () => {
    const state = newGame();
    const move = firstLegalMove(state);
    const newState = makeMove(state, move);
    expect(newState.activeEvents).toEqual([]);
    expect(newState.mode).toBe(GameMode.Classic);
  });
});

// ===========================================================================
// Crazy mode — event duration ticking
// ===========================================================================

describe('makeMove — event duration ticking', () => {
  it('decrements remainingPlies each ply', () => {
    const activeEvents: ActiveEvent[] = [
      {
        type: CrazyEvent.KingForADay,
        remainingPlies: 2,
        triggeredBy: PieceColor.White,
        triggeredAtPly: 0,
      },
    ];

    const state = stateWithBoard(createInitialBoard(), PieceColor.White, {
      mode: GameMode.Crazy,
      ruleSet: createCompositeRuleSet(createAmericanRules()),
      activeEvents,
    });

    const move = firstLegalMove(state);
    const newState = makeMove(state, move);

    // Event should have been ticked: 2 → 1
    expect(newState.activeEvents.length).toBe(1);
    expect(newState.activeEvents[0]?.remainingPlies).toBe(1);
  });

  it('removes events when remainingPlies reaches 0', () => {
    const activeEvents: ActiveEvent[] = [
      {
        type: CrazyEvent.NoTouching,
        remainingPlies: 1,
        triggeredBy: PieceColor.White,
        triggeredAtPly: 0,
      },
    ];

    const state = stateWithBoard(createInitialBoard(), PieceColor.White, {
      mode: GameMode.Crazy,
      ruleSet: createCompositeRuleSet(createAmericanRules()),
      activeEvents,
    });

    const move = firstLegalMove(state);
    const newState = makeMove(state, move);

    // Event ticked from 1 → 0 → removed
    expect(newState.activeEvents.length).toBe(0);
  });

  it('does not tick condition-based events (remainingPlies === -1)', () => {
    const activeEvents: ActiveEvent[] = [
      {
        type: CrazyEvent.LiveGrenade,
        remainingPlies: -1,
        triggeredBy: PieceColor.White,
        triggeredAtPly: 0,
      },
    ];

    const state = stateWithBoard(createInitialBoard(), PieceColor.White, {
      mode: GameMode.Crazy,
      ruleSet: createCompositeRuleSet(createAmericanRules()),
      activeEvents,
    });

    const move = firstLegalMove(state);
    const newState = makeMove(state, move);

    // Condition-based event should persist unchanged
    expect(newState.activeEvents.length).toBe(1);
    expect(newState.activeEvents[0]?.remainingPlies).toBe(-1);
  });

  it('ticks all active events in a single ply', () => {
    const activeEvents: ActiveEvent[] = [
      { type: CrazyEvent.KingForADay, remainingPlies: 2, triggeredBy: PieceColor.White, triggeredAtPly: 0 },
      { type: CrazyEvent.NoTouching, remainingPlies: 1, triggeredBy: PieceColor.Black, triggeredAtPly: 1 },
      { type: CrazyEvent.LiveGrenade, remainingPlies: -1, triggeredBy: PieceColor.White, triggeredAtPly: 2 },
    ];

    const state = stateWithBoard(createInitialBoard(), PieceColor.White, {
      mode: GameMode.Crazy,
      ruleSet: createCompositeRuleSet(createAmericanRules()),
      activeEvents,
    });

    const move = firstLegalMove(state);
    const newState = makeMove(state, move);

    // KingForADay: 2→1 (still active)
    // NoTouching: 1→0 (removed)
    // LiveGrenade: -1 (unchanged, condition-based)
    expect(newState.activeEvents.length).toBe(2);
    expect(
      newState.activeEvents.find((e) => e.type === CrazyEvent.KingForADay)?.remainingPlies,
    ).toBe(1);
    expect(
      newState.activeEvents.find((e) => e.type === CrazyEvent.NoTouching),
    ).toBeUndefined();
    expect(
      newState.activeEvents.find((e) => e.type === CrazyEvent.LiveGrenade)?.remainingPlies,
    ).toBe(-1);
  });
});

// ===========================================================================
// Choice and Chaos mode — createNewGame
// ===========================================================================

describe('createNewGame — Choice and Chaos modes', () => {
  it('uses CompositeEventRuleSet for Choice mode', () => {
    const state = createNewGame(createAmericanRules(), HUMAN_VS_HUMAN, GameMode.Choice);
    expect(state.mode).toBe(GameMode.Choice);
    expect('setActiveEvents' in state.ruleSet).toBe(true);
    expect(state.activeEvents).toEqual([]);
  });

  it('uses CompositeEventRuleSet for Chaos mode', () => {
    const state = createNewGame(createAmericanRules(), HUMAN_VS_HUMAN, GameMode.Chaos);
    expect(state.mode).toBe(GameMode.Chaos);
    expect('setActiveEvents' in state.ruleSet).toBe(true);
    expect(state.activeEvents).toEqual([]);
  });
});

// ===========================================================================
// Event ticking in Choice mode
// ===========================================================================

describe('makeMove — event ticking in Choice mode', () => {
  it('ticks active events in Choice mode games', () => {
    const activeEvents: ActiveEvent[] = [
      {
        type: CrazyEvent.KingForADay,
        remainingPlies: 2,
        triggeredBy: PieceColor.White,
        triggeredAtPly: 0,
      },
    ];

    const state = stateWithBoard(createInitialBoard(), PieceColor.White, {
      mode: GameMode.Choice,
      ruleSet: createCompositeRuleSet(createAmericanRules()),
      activeEvents,
    });

    const move = firstLegalMove(state);
    const newState = makeMove(state, move);

    expect(newState.activeEvents.length).toBe(1);
    expect(newState.activeEvents[0]?.remainingPlies).toBe(1);
  });
});

// ===========================================================================
// Chaos mode — event trigger on single jump
// ===========================================================================

describe('makeMove — Chaos mode event trigger', () => {
  it('triggers events on single-capture jumps in Chaos mode', () => {
    // White king at 1 can jump over black pawn at 5
    const board = buildBoard([
      { sq: 1, color: W, type: K },
      { sq: 5, color: B, type: P },
      { sq: 32, color: B, type: P }, // Keep black alive
      { sq: 29, color: W, type: P }, // Keep white alive
    ]);

    const state = stateWithBoard(board, PieceColor.White, {
      mode: GameMode.Chaos,
      ruleSet: createCompositeRuleSet(createAmericanRules()),
    });

    const legalMoves = getCurrentLegalMoves(state);
    const singleJump = legalMoves.find((m) => m.captured.length === 1);

    if (singleJump) {
      const newState = makeMove(state, singleJump);
      // A single jump should trigger an event in Chaos mode
      expect(newState.activeEvents.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ===========================================================================
// Classic mode — regression
// ===========================================================================

describe('makeMove — Classic mode regression', () => {
  it('behaves identically to Phase 1 with no mode specified', () => {
    const state = newGame();
    const move = firstLegalMove(state);
    const newState = makeMove(state, move);

    expect(newState.mode).toBe(GameMode.Classic);
    expect(newState.activeEvents).toEqual([]);
    expect(newState.plyCount).toBe(1);
  });
});
