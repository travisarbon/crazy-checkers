/**
 * EvaluationProvider interface and MinimaxEvaluationProvider implementation (Task 21.1).
 *
 * Wraps src/ai/evaluator and src/ai/search so Cogitate tools can request
 * static evaluations and top-N moves without knowing the underlying engine.
 */

import type {
  ActiveEvent,
  BoardState,
  GameState,
  PieceColor,
  PlayerSetup,
  RuleSet,
} from '../engine/types';
import {
  GameMode,
  GameStatus,
  PieceColor as PieceColorEnum,
  PlayerType,
} from '../engine/types';
import type { SearchConfig } from '../ai/search';
import { iterativeSearch } from '../ai/search';
import { evaluate } from '../ai/evaluator';
import { evaluateWithEvents } from '../ai/eventEvalWeights';
import type { EvaluatedMove, NormalizedEvaluation } from './types';
import { EVAL_BAR_SIGMOID_K, EVAL_TERMINAL_THRESHOLD } from './types';
import type { NotationAdapter } from './NotationAdapter';
import { getCheckersNotationAdapter } from './NotationAdapter';

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/**
 * Maps a raw evaluator score to [-1.0, +1.0] via sigmoid.
 * Clamps terminal-sized scores to ±1.0.
 */
export function normalizeRawScore(
  rawScore: number,
  activeColor: PieceColor,
): { score: number; isTerminal: boolean } {
  if (!Number.isFinite(rawScore)) {
    const sign = rawScore > 0 ? 1 : -1;
    const signed = activeColor === PieceColorEnum.White ? sign : -sign;
    return { score: signed, isTerminal: true };
  }

  const whiteOriented =
    activeColor === PieceColorEnum.White ? rawScore : -rawScore;

  if (Math.abs(whiteOriented) >= EVAL_TERMINAL_THRESHOLD) {
    return { score: whiteOriented > 0 ? 1 : -1, isTerminal: true };
  }

  const sigmoid = whiteOriented / (Math.abs(whiteOriented) + EVAL_BAR_SIGMOID_K);
  // Guard against floating noise pushing the result slightly outside the range.
  const clamped = Math.max(-1, Math.min(1, sigmoid));
  return { score: clamped, isTerminal: false };
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface EvaluationProvider {
  /** Evaluate a single position and return a normalized score, or null if not supported. */
  evaluate(
    board: BoardState,
    activeColor: PieceColor,
    eventContext?: readonly ActiveEvent[],
  ): NormalizedEvaluation | null;

  /** Get the top N moves from a position, sorted by descending score. */
  getTopMoves(
    board: BoardState,
    activeColor: PieceColor,
    count: number,
    ruleSet: RuleSet,
    config: SearchConfig,
    eventContext?: readonly ActiveEvent[],
  ): EvaluatedMove[];

  readonly isAvailable: boolean;
  readonly providerType: string;
}

// ---------------------------------------------------------------------------
// MinimaxEvaluationProvider
// ---------------------------------------------------------------------------

const DEFAULT_PLAYERS: PlayerSetup = {
  white: PlayerType.Human,
  black: PlayerType.Human,
};

export class MinimaxEvaluationProvider implements EvaluationProvider {
  readonly isAvailable = true;
  readonly providerType = 'minimax';

  private readonly notation: NotationAdapter;

  constructor(notation: NotationAdapter = getCheckersNotationAdapter()) {
    this.notation = notation;
  }

  evaluate(
    board: BoardState,
    activeColor: PieceColor,
    eventContext?: readonly ActiveEvent[],
  ): NormalizedEvaluation {
    const raw =
      eventContext && eventContext.length > 0
        ? evaluateWithEvents(board, activeColor, eventContext)
        : evaluate(board, activeColor);
    const { score, isTerminal } = normalizeRawScore(raw, activeColor);
    return {
      score,
      rawScore: raw,
      isTerminal,
      confidence: 1,
    };
  }

  getTopMoves(
    board: BoardState,
    activeColor: PieceColor,
    count: number,
    ruleSet: RuleSet,
    config: SearchConfig,
    eventContext?: readonly ActiveEvent[],
  ): EvaluatedMove[] {
    if (count <= 0) return [];
    const state: GameState = {
      board,
      activeColor,
      status: GameStatus.InProgress,
      result: null,
      ruleSet,
      players: DEFAULT_PLAYERS,
      moveHistory: [],
      positionHashes: [],
      halfMoveClock: 0,
      plyCount: 0,
      mode: eventContext && eventContext.length > 0 ? GameMode.Crazy : GameMode.Classic,
      activeEvents: eventContext ?? [],
    };

    const result = iterativeSearch(state, config);
    const scored = [...result.rootMoveScores].sort((a, b) => b.score - a.score);
    const top = scored.slice(0, count);
    return top.map((entry) => {
      const { score: normalized } = normalizeRawScore(entry.score, activeColor);
      return {
        move: entry.move,
        notation: this.notation.moveToString(entry.move, board),
        score: entry.score,
        normalizedScore: normalized,
      };
    });
  }
}

let cached: MinimaxEvaluationProvider | null = null;

/** Returns a shared MinimaxEvaluationProvider instance. */
export function getMinimaxEvaluationProvider(): MinimaxEvaluationProvider {
  if (!cached) cached = new MinimaxEvaluationProvider();
  return cached;
}
