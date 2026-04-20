/**
 * Phase 3 EvaluationProvider wrapper for Tier 1 Classified draughts
 * (Task 28.6 §5).
 *
 * Wraps Task 28.5's `ParameterizedDraughtsEvaluationProvider` into the
 * Phase 3 `EvaluationProvider` interface consumed by Cogitate Analysis
 * and Training tools.
 *
 * The bridge converts:
 *  - `BoardState` → `ClassifiedGameState` (via runtime type check)
 *  - Raw integer scores → normalised [-1, 1] via sigmoid
 *  - Phase 4 DraughtsMove → Phase 3 EvaluatedMove
 */

import type { BoardState, Move, PieceColor } from '../../../engine/types';
import type { ClassifiedGameState } from '../../../engine/classified/state';
import { isClassifiedGameState } from '../../../engine/classified/state';
import type { DraughtsGameId } from '../../../engine/classified/draughts/DraughtsConfig';
import { createDraughtsConfig } from '../../../engine/classified/draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../../../engine/classified/draughts/ParameterizedDraughtsRules';
import type { EvaluationProvider } from '../../EvaluationProvider';
import type { EvaluatedMove, NormalizedEvaluation } from '../../types';
import type { SearchConfig } from '../../../ai/search';
import type { RuleSet } from '../../../engine/types';
import { getDraughtsWeights } from '../../../ai/evaluators/draughts/weights';
import { evaluateDraughtsPosition } from '../../../ai/evaluators/draughts/DraughtsEvaluator';
import {
  classifiedIterativeSearch,
} from '../../../ai/evaluators/draughts/classifiedSearch';
import { getDraughtsDifficultyConfig } from '../../../ai/evaluators/draughts/difficultyPresets';
import { normalizeDraughtsScore } from '../../../ai/evaluators/draughts/DraughtsEvaluationProvider';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIDENCE = 0.6;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a Phase 3 EvaluationProvider that wraps Task 28.5's draughts
 * evaluation infrastructure.
 */
export function createDraughtsEvaluationProviderBridge(
  gameId: DraughtsGameId,
): EvaluationProvider {
  const config = createDraughtsConfig(gameId);
  const weights = getDraughtsWeights(gameId);
  const ruleSet = createDraughtsRuleSet(config);

  return {
    isAvailable: true,
    providerType: 'classified-draughts',

    evaluate(
      board: BoardState,
    ): NormalizedEvaluation | null {
      if (!isClassifiedGameState(board)) return null;
      const state = board as unknown as ClassifiedGameState;
      const turn = (state.turn ?? 'white') as 'white' | 'black';

      const moves = ruleSet.getLegalMoves(state);
      const raw = evaluateDraughtsPosition(state, config, weights, moves.length);
      const { score, isTerminal } = normalizeDraughtsScore(raw, turn, weights.sigmoidK);

      return {
        score,
        rawScore: raw,
        isTerminal,
        confidence: DEFAULT_CONFIDENCE,
      };
    },

    getTopMoves(
      board: BoardState,
      _activeColor: PieceColor,
      count: number,
      _ruleSet: RuleSet,
      searchConfig: SearchConfig,
    ): EvaluatedMove[] {
      if (count <= 0) return [];
      if (!isClassifiedGameState(board)) return [];

      const state = board as unknown as ClassifiedGameState;
      const turn = (state.turn ?? 'white') as 'white' | 'black';

      const diffConfig = getDraughtsDifficultyConfig(config, 'hard');
      const adjustedConfig = {
        ...diffConfig,
        maxDepth: searchConfig.maxDepth,
        timeLimitMs: searchConfig.timeLimitMs,
      };

      const result = classifiedIterativeSearch(
        state,
        ruleSet,
        config,
        weights,
        adjustedConfig,
      );

      const sorted = [...result.rootMoveScores].sort((a, b) => b.score - a.score);
      const top = sorted.slice(0, count);

      return top.map((entry) => {
        const { score: normalized } = normalizeDraughtsScore(
          entry.score,
          turn,
          weights.sigmoidK,
        );
        return {
          move: draughtsMoveToPhase1Move(entry.move),
          notation: `${entry.move.from}-${entry.move.to}`,
          score: entry.score,
          normalizedScore: normalized,
        };
      });
    },
  };
}

/**
 * Converts a DraughtsMove to a Phase 1 Move for EvaluatedMove compatibility.
 */
function draughtsMoveToPhase1Move(
  dm: import('../../../engine/classified/draughts/moveGen').DraughtsMove,
): Move {
  const from = Number(dm.from);
  const to = Number(dm.to);
  const captured = dm.capture.map(Number);
  return {
    from: from as unknown as import('../../../engine/types').Square,
    path: [to as unknown as import('../../../engine/types').Square],
    captured: captured as unknown as import('../../../engine/types').Square[],
  };
}
