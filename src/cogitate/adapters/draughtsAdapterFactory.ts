/**
 * Shared factory for draughts-family Cogitate adapters (Classic, Crazy, Chaos, Choice).
 *
 * Concrete adapters are thin wrappers that call createDraughtsAdapter with
 * mode-specific configuration.
 */

import type { ActiveEvent, BoardState, Piece, RuleSet } from '../../engine/types';
import { CrazyEvent, PieceColor, PieceType, square } from '../../engine/types';
import { BOARD_SIZE, createInitialBoard, squareToGrid } from '../../engine/board';
import { createAmericanRules } from '../../engine/rules';
import { createCompositeRuleSet } from '../../engine/compositeRuleSet';
import {
  deserializeBoardState,
  serializeBoard as serializeBoardStr,
} from '../../persistence/serialization';
import type { Difficulty } from '../../ai/difficulty';
import { getDifficultyConfig, toSearchConfig } from '../../ai/difficulty';
import type { SearchConfig } from '../../ai/search';
import type { CogitateGameAdapter } from '../CogitateGameAdapter';
import type { EvaluationProvider } from '../EvaluationProvider';
import { getMinimaxEvaluationProvider } from '../EvaluationProvider';
import type { NotationAdapter } from '../NotationAdapter';
import { getCheckersNotationAdapter } from '../NotationAdapter';
import type {
  BoardGeometry,
  PieceDefinition,
  ValidationResult,
} from '../types';
import { DRAUGHTS_BOARD_GEOMETRY } from '../types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface DraughtsAdapterConfig {
  readonly modeId: string;
  /** When true, wrap the base ruleset with a CompositeEventRuleSet (events may be active). */
  readonly supportsEvents: boolean;
  /** Permanent event forever present (Choice modes). Null for plain Crazy. */
  readonly permanentEvent?: CrazyEvent | null;
}

// ---------------------------------------------------------------------------
// Piece palette
// ---------------------------------------------------------------------------

const DRAUGHTS_PIECE_PALETTE: readonly PieceDefinition[] = Object.freeze([
  {
    color: PieceColor.White,
    type: PieceType.Pawn,
    displayName: 'White Pawn',
    renderKey: 'white-pawn',
  },
  {
    color: PieceColor.White,
    type: PieceType.King,
    displayName: 'White King',
    renderKey: 'white-king',
  },
  {
    color: PieceColor.Black,
    type: PieceType.Pawn,
    displayName: 'Black Pawn',
    renderKey: 'black-pawn',
  },
  {
    color: PieceColor.Black,
    type: PieceType.King,
    displayName: 'Black King',
    renderKey: 'black-king',
  },
]);

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateDraughtsPosition(board: BoardState): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (board.length !== BOARD_SIZE) {
    errors.push(`Board must have ${String(BOARD_SIZE)} squares, got ${String(board.length)}`);
    return { isLegal: false, errors, warnings };
  }

  let whiteTotal = 0;
  let blackTotal = 0;
  let whitePawnsOnPromotion = 0;
  let blackPawnsOnPromotion = 0;

  for (let i = 0; i < BOARD_SIZE; i++) {
    const sq = board[i] as Piece | null;
    if (!sq) continue;
    if (sq.color === PieceColor.White) whiteTotal++;
    else blackTotal++;

    if (sq.type === PieceType.Pawn) {
      const { row } = squareToGrid(square(i + 1));
      if (sq.color === PieceColor.White && row === 0) whitePawnsOnPromotion++;
      if (sq.color === PieceColor.Black && row === 7) blackPawnsOnPromotion++;
    }
  }

  if (whiteTotal === 0 && blackTotal === 0) {
    errors.push('No pieces on board');
  }
  if (whiteTotal > 12) {
    errors.push(`Too many White pieces (${String(whiteTotal)} > 12)`);
  }
  if (blackTotal > 12) {
    errors.push(`Too many Black pieces (${String(blackTotal)} > 12)`);
  }
  if (whitePawnsOnPromotion > 0) {
    warnings.push(
      `${String(whitePawnsOnPromotion)} White pawn(s) on promotion row (should be kings)`,
    );
  }
  if (blackPawnsOnPromotion > 0) {
    warnings.push(
      `${String(blackPawnsOnPromotion)} Black pawn(s) on promotion row (should be kings)`,
    );
  }

  return {
    isLegal: errors.length === 0,
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const RAW_EVAL_RANGE: readonly [number, number] = [-10_000, 10_000];

function buildPermanentEvent(event: CrazyEvent): ActiveEvent {
  return {
    type: event,
    remainingPlies: -1,
    triggeredBy: PieceColor.White,
    triggeredAtPly: 0,
    permanent: true,
  };
}

/**
 * Creates a draughts-family Cogitate adapter.
 *
 * For adapters with `supportsEvents: true`, the returned getRuleSet builds
 * a fresh CompositeEventRuleSet each call so the caller's provided event
 * context doesn't leak between invocations (the composite caches decorator
 * chains internally).
 */
export function createDraughtsAdapter(
  config: DraughtsAdapterConfig,
): CogitateGameAdapter {
  const notation: NotationAdapter = getCheckersNotationAdapter();
  const provider: EvaluationProvider = getMinimaxEvaluationProvider();
  const geometry: BoardGeometry = DRAUGHTS_BOARD_GEOMETRY;

  const permanent: ActiveEvent | null =
    config.permanentEvent != null ? buildPermanentEvent(config.permanentEvent) : null;

  return {
    modeId: config.modeId,

    getBoard(boardStateStr: string): BoardState {
      return deserializeBoardState(boardStateStr);
    },

    serializeBoard(board: BoardState): string {
      return serializeBoardStr(board);
    },

    getRuleSet(eventContext?: readonly ActiveEvent[]): RuleSet {
      const base = createAmericanRules();
      if (!config.supportsEvents) return base;

      const composite = createCompositeRuleSet(base);
      const events: ActiveEvent[] = [];
      if (permanent) events.push(permanent);
      if (eventContext) {
        for (const e of eventContext) {
          if (!permanent || e.type !== permanent.type) events.push(e);
        }
      }
      composite.setActiveEvents(events);
      return composite;
    },

    getAIConfig(difficulty: Difficulty): SearchConfig {
      return toSearchConfig(getDifficultyConfig(difficulty));
    },

    getPiecePalette(): readonly PieceDefinition[] {
      return DRAUGHTS_PIECE_PALETTE;
    },

    getBoardGeometry(): BoardGeometry {
      return geometry;
    },

    getStartingPosition(): BoardState {
      return createInitialBoard();
    },

    validatePosition(board: BoardState): ValidationResult {
      return validateDraughtsPosition(board);
    },

    getNotationAdapter(): NotationAdapter {
      return notation;
    },

    supportsEvaluation(): boolean {
      return true;
    },

    getEvaluationRange(): readonly [number, number] {
      return RAW_EVAL_RANGE;
    },

    getEvaluationProvider(): EvaluationProvider {
      return provider;
    },
  };
}
