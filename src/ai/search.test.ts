import { describe, it, expect } from 'vitest';
import { iterativeSearch } from './search';
import type { SearchConfig } from './search';
import { buildBoard, W, B, P, K } from '../engine/test-utils';
import { GameMode, PieceColor, square, GameStatus, PlayerType } from '../engine/types';
import type { BoardState, GameState, Move } from '../engine/types';
import { createAmericanRules } from '../engine/rules';
import { createNewGame, makeMove } from '../engine/game';
import { EVAL_WEIGHTS } from './evaluator';

const rules = createAmericanRules();

/** Helper to create a GameState from a custom board for testing. */
function stateFromBoard(board: BoardState, activeColor: PieceColor = PieceColor.White): GameState {
  return {
    board,
    activeColor,
    status: GameStatus.InProgress,
    result: null,
    ruleSet: rules,
    players: { white: PlayerType.Human, black: PlayerType.CpuHard },
    moveHistory: [],
    positionHashes: [0n],
    halfMoveClock: 0,
    plyCount: 0,
    mode: GameMode.Classic,
    activeEvents: [],
  };
}

/** Asserts the result has a move and returns it. */
function expectMove(result: { move: Move | null }): Move {
  expect(result.move).not.toBeNull();
  return result.move as Move;
}

/** Shallow search config for fast tests. */
const FAST_CONFIG: SearchConfig = {
  maxDepth: 4,
  timeLimitMs: 5000,
  quiescenceEnabled: false,
  quiescenceMaxDepth: 0,
};

// ---------------------------------------------------------------------------
// Basic behavior
// ---------------------------------------------------------------------------

describe('iterativeSearch — basic behavior', () => {
  it('returns the only legal move when exactly one exists', () => {
    // White pawn on 21 can only move to 17. Black pawns on 1,2 don't interfere.
    const board = buildBoard([
      { sq: 21, color: W, type: P },
      { sq: 1, color: B, type: P },
      { sq: 2, color: B, type: P },
    ]);
    const state = stateFromBoard(board, PieceColor.White);
    const legalMoves = rules.getLegalMoves(board, PieceColor.White);

    // Verify there's exactly one legal move
    expect(legalMoves.length).toBe(1);

    const result = iterativeSearch(state, FAST_CONFIG);
    const move = expectMove(result);
    expect(move.from).toBe(square(21));
  });

  it('returns null move when no legal moves exist', () => {
    // White pawn on 5 completely blocked by black pawns on 1 and 2
    const board = buildBoard([
      { sq: 5, color: W, type: P },
      { sq: 1, color: B, type: P },
      { sq: 2, color: B, type: P },
    ]);
    const state = stateFromBoard(board, PieceColor.White);
    const legalMoves = rules.getLegalMoves(board, PieceColor.White);
    expect(legalMoves.length).toBe(0);

    const result = iterativeSearch(state, FAST_CONFIG);
    expect(result.move).toBeNull();
    expect(result.score).toBe(EVAL_WEIGHTS.lossScore);
  });

  it('returns a valid legal move from the starting position', () => {
    const state = createNewGame(rules, {
      white: PlayerType.Human,
      black: PlayerType.CpuHard,
    });
    const result = iterativeSearch(state, FAST_CONFIG);
    const move = expectMove(result);

    const legalMoves = rules.getLegalMoves(state.board, state.activeColor);
    const isLegal = legalMoves.some(
      (m) =>
        (m.from as number) === (move.from as number) &&
        m.path.length === move.path.length &&
        m.path.every((p, i) => (p as number) === (move.path[i] as number)),
    );
    expect(isLegal).toBe(true);
    expect(result.depth).toBeGreaterThanOrEqual(1);
  });

  it('search depth respects maxDepth configuration', () => {
    const state = createNewGame(rules, {
      white: PlayerType.Human,
      black: PlayerType.CpuHard,
    });
    const config: SearchConfig = {
      maxDepth: 2,
      timeLimitMs: 10000,
      quiescenceEnabled: false,
      quiescenceMaxDepth: 0,
    };
    const result = iterativeSearch(state, config);
    expect(result.depth).toBe(2);
  });

  it('search respects time limit', () => {
    const state = createNewGame(rules, {
      white: PlayerType.Human,
      black: PlayerType.CpuHard,
    });
    const config: SearchConfig = {
      maxDepth: 20,
      timeLimitMs: 50,
      quiescenceEnabled: false,
      quiescenceMaxDepth: 0,
    };
    const result = iterativeSearch(state, config);
    expect(result.depth).toBeLessThan(20);
    expect(result.move).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Forced captures
// ---------------------------------------------------------------------------

describe('iterativeSearch — forced captures', () => {
  it('AI finds a forced single capture when available', () => {
    // White pawn on 22, Black pawn on 18. White can jump 22→15.
    // Add extra pieces so the game isn't trivially over.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 32, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 1, color: B, type: P },
    ]);
    const state = stateFromBoard(board, PieceColor.White);
    const result = iterativeSearch(state, FAST_CONFIG);
    const move = expectMove(result);

    expect(move.from).toBe(square(22));
    expect(move.captured.length).toBeGreaterThanOrEqual(1);
  });

  it('AI finds a forced multi-jump capture', () => {
    // White pawn on 24 (row5,col6), Black pawns on 19 (row4,col5) and 10 (row2,col3).
    // White can chain: 24→15 (captures 19), then 15→6 (captures 10).
    // Add extra pieces to prevent trivial game-over.
    const board = buildBoard([
      { sq: 24, color: W, type: P },
      { sq: 29, color: W, type: P },
      { sq: 19, color: B, type: P },
      { sq: 10, color: B, type: P },
      { sq: 2, color: B, type: P },
    ]);
    const state = stateFromBoard(board, PieceColor.White);

    // Verify the multi-jump exists
    const legalMoves = rules.getLegalMoves(board, PieceColor.White);
    const multiJump = legalMoves.find((m) => m.captured.length === 2);
    expect(multiJump).toBeDefined();

    const result = iterativeSearch(state, FAST_CONFIG);
    const move = expectMove(result);
    expect(move.captured.length).toBe(2);
  });

  it('AI prefers capturing more pieces when given a choice', () => {
    // White king on 26 can chain capture via two black pieces.
    // In American Rules, mandatory capture doesn't require maximum, but AI should
    // prefer more captures for better evaluation.
    const board = buildBoard([
      { sq: 26, color: W, type: K },
      { sq: 30, color: W, type: P },
      { sq: 22, color: B, type: P },
      { sq: 11, color: B, type: P },
      { sq: 1, color: B, type: P },
    ]);
    const state = stateFromBoard(board, PieceColor.White);

    const legalMoves = rules.getLegalMoves(board, PieceColor.White);
    const hasMultiCapture = legalMoves.some((m) => m.captured.length >= 2);

    if (hasMultiCapture) {
      const result = iterativeSearch(state, FAST_CONFIG);
      const move = expectMove(result);
      expect(move.captured.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Winning sequences
// ---------------------------------------------------------------------------

describe('iterativeSearch — winning sequences', () => {
  it('AI finds a two-move winning sequence in a simple endgame', () => {
    // White has 2 kings in strong positions, Black has 1 pawn with limited mobility.
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 19, color: W, type: K },
      { sq: 10, color: B, type: P },
    ]);
    const state = stateFromBoard(board, PieceColor.White);
    const config: SearchConfig = {
      maxDepth: 6,
      timeLimitMs: 5000,
      quiescenceEnabled: true,
      quiescenceMaxDepth: 4,
    };
    const result = iterativeSearch(state, config);
    expectMove(result);

    // Should find a winning position (near-win score)
    expect(result.score).toBeGreaterThanOrEqual(EVAL_WEIGHTS.winScore - 10);
  });

  it('AI avoids a losing move when one exists', () => {
    // White king on 15, Black king on 3.
    // White also has pawn on 29. Black has pawn on 12.
    const board = buildBoard([
      { sq: 15, color: W, type: K },
      { sq: 29, color: W, type: P },
      { sq: 3, color: B, type: K },
      { sq: 12, color: B, type: P },
    ]);
    const state = stateFromBoard(board, PieceColor.White);
    const result = iterativeSearch(state, FAST_CONFIG);
    expectMove(result);

    // Score should not indicate a losing position
    expect(result.score).toBeGreaterThan(EVAL_WEIGHTS.lossScore);
  });

  it('AI does not blunder material', () => {
    // White has king on 18, pawn on 22. Black has king on 7.
    const board = buildBoard([
      { sq: 18, color: W, type: K },
      { sq: 22, color: W, type: P },
      { sq: 7, color: B, type: K },
    ]);
    const state = stateFromBoard(board, PieceColor.White);
    const result = iterativeSearch(state, FAST_CONFIG);
    expectMove(result);

    // The AI should find a strong continuation, not blunder
    expect(result.score).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Quiescence search
// ---------------------------------------------------------------------------

describe('iterativeSearch — quiescence search', () => {
  it('quiescence search improves evaluation in capture-heavy positions', () => {
    // Position where a capture chain is about to resolve.
    const board = buildBoard([
      { sq: 22, color: W, type: K },
      { sq: 32, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 11, color: B, type: P },
      { sq: 1, color: B, type: P },
    ]);
    const state = stateFromBoard(board, PieceColor.White);

    const noQConfig: SearchConfig = {
      maxDepth: 2,
      timeLimitMs: 5000,
      quiescenceEnabled: false,
      quiescenceMaxDepth: 0,
    };
    const qConfig: SearchConfig = {
      maxDepth: 2,
      timeLimitMs: 5000,
      quiescenceEnabled: true,
      quiescenceMaxDepth: 4,
    };

    const resultNoQ = iterativeSearch(state, noQConfig);
    const resultQ = iterativeSearch(state, qConfig);

    // Both should return valid moves
    expectMove(resultNoQ);
    expectMove(resultQ);

    // Quiescence should evaluate more nodes (it searches deeper into captures)
    expect(resultQ.nodesEvaluated).toBeGreaterThanOrEqual(resultNoQ.nodesEvaluated);
  });

  it('quiescence depth limit prevents explosion', () => {
    // Position with many pieces that could create long capture sequences.
    const board = buildBoard([
      { sq: 32, color: W, type: K },
      { sq: 30, color: W, type: K },
      { sq: 21, color: W, type: P },
      { sq: 1, color: B, type: K },
      { sq: 3, color: B, type: K },
      { sq: 12, color: B, type: P },
    ]);
    const state = stateFromBoard(board, PieceColor.White);

    const config: SearchConfig = {
      maxDepth: 4,
      timeLimitMs: 2000,
      quiescenceEnabled: true,
      quiescenceMaxDepth: 4,
    };

    const start = performance.now();
    const result = iterativeSearch(state, config);
    const elapsed = performance.now() - start;

    expectMove(result);
    expect(elapsed).toBeLessThan(2000);
  });
});

// ---------------------------------------------------------------------------
// Iterative deepening behavior
// ---------------------------------------------------------------------------

describe('iterativeSearch — iterative deepening', () => {
  it('deeper search produces equal or better move quality', () => {
    const board = buildBoard([
      { sq: 21, color: W, type: P },
      { sq: 22, color: W, type: P },
      { sq: 23, color: W, type: P },
      { sq: 29, color: W, type: P },
      { sq: 30, color: W, type: P },
      { sq: 10, color: B, type: P },
      { sq: 11, color: B, type: P },
      { sq: 12, color: B, type: P },
      { sq: 3, color: B, type: P },
      { sq: 4, color: B, type: P },
    ]);
    const state = stateFromBoard(board, PieceColor.White);

    const shallowConfig: SearchConfig = {
      maxDepth: 2,
      timeLimitMs: 5000,
      quiescenceEnabled: false,
      quiescenceMaxDepth: 0,
    };
    const deepConfig: SearchConfig = {
      maxDepth: 6,
      timeLimitMs: 5000,
      quiescenceEnabled: false,
      quiescenceMaxDepth: 0,
    };

    const resultA = iterativeSearch(state, shallowConfig);
    const resultB = iterativeSearch(state, deepConfig);

    // Deeper search should find equal or better score (with small tolerance)
    expect(resultB.score).toBeGreaterThanOrEqual(resultA.score - 20);
  });

  it('early termination on forced win', () => {
    // White has 3 kings surrounding Black's last pawn. Win in 1–2 moves.
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 15, color: W, type: K },
      { sq: 19, color: W, type: K },
      { sq: 10, color: B, type: P },
    ]);
    const state = stateFromBoard(board, PieceColor.White);

    const config: SearchConfig = {
      maxDepth: 10,
      timeLimitMs: 5000,
      quiescenceEnabled: true,
      quiescenceMaxDepth: 4,
    };

    const result = iterativeSearch(state, config);
    expect(result.depth).toBeLessThan(10);
    expect(result.score).toBeGreaterThanOrEqual(EVAL_WEIGHTS.winScore - result.depth);
  });
});

// ---------------------------------------------------------------------------
// Move ordering
// ---------------------------------------------------------------------------

describe('iterativeSearch — move ordering', () => {
  it('search evaluates a bounded number of nodes', () => {
    const state = createNewGame(rules, {
      white: PlayerType.Human,
      black: PlayerType.CpuHard,
    });
    const result = iterativeSearch(state, FAST_CONFIG);

    // Establishing a baseline: with move ordering the search should be efficient
    expect(result.nodesEvaluated).toBeGreaterThan(0);
    expect(result.nodesEvaluated).toBeLessThan(1_000_000);
  });
});

// ---------------------------------------------------------------------------
// AI vs. AI self-play integration
// ---------------------------------------------------------------------------

describe('iterativeSearch — AI vs. AI integration', () => {
  it('a 50-game AI vs. AI match completes without errors', () => {
    const selfPlayConfig: SearchConfig = {
      maxDepth: 4,
      timeLimitMs: 2000,
      quiescenceEnabled: false,
      quiescenceMaxDepth: 0,
    };

    let totalGames = 0;
    let wins = 0;
    const maxMoves = 200;

    for (let game = 0; game < 50; game++) {
      let state = createNewGame(rules, {
        white: PlayerType.CpuHard,
        black: PlayerType.CpuHard,
      });

      let moveCount = 0;
      while (state.status === GameStatus.InProgress && moveCount < maxMoves) {
        const result = iterativeSearch(state, selfPlayConfig);
        const move = expectMove(result);

        // The returned move must be in the legal moves
        const legalMoves = rules.getLegalMoves(state.board, state.activeColor);
        const isLegal = legalMoves.some(
          (m) =>
            (m.from as number) === (move.from as number) &&
            m.path.length === move.path.length &&
            m.path.every((p, i) => (p as number) === (move.path[i] as number)) &&
            m.captured.length === move.captured.length,
        );
        expect(isLegal).toBe(true);

        state = makeMove(state, move);
        moveCount++;
      }

      // Game should terminate within the move limit
      expect(moveCount).toBeLessThan(maxMoves);
      totalGames++;

      if (state.status === GameStatus.GameOver && state.result !== null) {
        if (state.result.type !== 'DRAW') {
          wins++;
        }
      }
    }

    expect(totalGames).toBe(50);
    // At least some games should end in wins (not all draws)
    expect(wins).toBeGreaterThan(0);
  }, 120_000); // Extended timeout for 50 games
});
