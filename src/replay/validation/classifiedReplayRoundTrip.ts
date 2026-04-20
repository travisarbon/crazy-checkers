/**
 * Classified draughts replay round-trip validation (Task 28.6 §7).
 *
 * Validates byte-identical state reconstruction for Tier 1 variants:
 *  1. Start from `ruleSet.startingPosition()`
 *  2. For each move: notate → parse → assert equality
 *  3. After final move: serialize → assert byte-identical to expected
 *
 * Produces `ReplayRoundTripReport` per variant (C-06 evidence).
 */

import type { ClassifiedGameState } from '../../engine/classified/state';
import type { ClassifiedMove, NotationAdapter as Phase4NotationAdapter } from '../../engine/classified/ClassifiedRuleSet';
import type { DraughtsGameId } from '../../engine/classified/draughts/DraughtsConfig';
import {
  createDraughtsConfig,
  TIER_1_DRAUGHTS_GAME_IDS,
} from '../../engine/classified/draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../../engine/classified/draughts/ParameterizedDraughtsRules';
import type { DraughtsMove } from '../../engine/classified/draughts/moveGen';
import { configToNotation } from '../../engine/classified/draughts/configToNotation';
import { getDraughtsWeights } from '../../ai/evaluators/draughts/weights';
import { getDraughtsDifficultyConfig } from '../../ai/evaluators/draughts/difficultyPresets';
import {
  classifiedIterativeSearch,
  selectClassifiedMove,
} from '../../ai/evaluators/draughts/classifiedSearch';
import { createSeededRandom } from '../../ai/validation/selfPlay';

// ---------------------------------------------------------------------------
// Report type
// ---------------------------------------------------------------------------

export interface ReplayRoundTripReport {
  readonly gameId: DraughtsGameId;
  readonly gamesTested: number;
  readonly gamesPassed: number;
  readonly gamesFailed: number;
  readonly firstFailureIndex: number | null;
  readonly firstFailureReason: string | null;
  readonly byteIdenticalSerialization: boolean;
  readonly notationRoundTripRate: number;
  readonly durationMs: number;
}

// ---------------------------------------------------------------------------
// Corpus generation
// ---------------------------------------------------------------------------

interface CorpusGame {
  readonly moves: readonly DraughtsMove[];
  readonly finalStateJson: string;
}

/**
 * Generates a corpus of self-play games using the classified search.
 */
function generateCorpus(
  gameId: DraughtsGameId,
  gameCount: number,
  seed: number,
): readonly CorpusGame[] {
  const config = createDraughtsConfig(gameId);
  const weights = getDraughtsWeights(gameId);
  const ruleSet = createDraughtsRuleSet(config);
  const diffConfig = getDraughtsDifficultyConfig(config, 'easy');
  // Use shallow depth for fast corpus generation
  const shallowConfig = { ...diffConfig, maxDepth: 2, timeLimitMs: 200 };

  const corpus: CorpusGame[] = [];

  for (let g = 0; g < gameCount; g++) {
    const gameSeed = seed + g * 7919;
    const randomFn = createSeededRandom(gameSeed);
    let state = ruleSet.startingPosition();
    const moves: DraughtsMove[] = [];

    for (let ply = 0; ply < 40; ply++) {
      const gameOver = ruleSet.checkGameOver(state);
      if (gameOver !== null) break;

      const legalMoves = ruleSet.getLegalMoves(state);
      if (legalMoves.length === 0) break;

      const result = classifiedIterativeSearch(
        state,
        ruleSet,
        config,
        weights,
        shallowConfig,
      );

      const selected = selectClassifiedMove(
        result,
        legalMoves,
        shallowConfig,
        randomFn,
      );

      moves.push(selected);
      state = ruleSet.applyMove(state, selected);
    }

    const finalStateJson = JSON.stringify(ruleSet.serializer.toJSON(state));
    corpus.push({ moves, finalStateJson });
  }

  return corpus;
}

// ---------------------------------------------------------------------------
// Round-trip validation
// ---------------------------------------------------------------------------

/**
 * Validates notation round-trip and serialization byte-identity for a
 * corpus of games.
 */
export function runClassifiedReplayRoundTrip(
  gameId: DraughtsGameId,
  gameCount = 5,
  seed = 42,
): ReplayRoundTripReport {
  const startTime = performance.now();
  const corpus = generateCorpus(gameId, gameCount, seed);

  const config = createDraughtsConfig(gameId);
  const ruleSet = createDraughtsRuleSet(config);
  const notation = configToNotation(config) as Phase4NotationAdapter<ClassifiedGameState, ClassifiedMove>;

  let gamesPassed = 0;
  let gamesFailed = 0;
  let firstFailureIndex: number | null = null;
  let firstFailureReason: string | null = null;
  let allByteIdentical = true;
  let totalMoves = 0;
  let roundTripSuccesses = 0;

  for (let g = 0; g < corpus.length; g++) {
    const game = corpus[g];
    if (!game) continue;
    let state = ruleSet.startingPosition();
    let gameFailed = false;

    for (const move of game.moves) {
      totalMoves++;

      // Notation round-trip: notate → parse → assert equality.
      const notated = notation.notate(state, move as unknown as ClassifiedMove);
      const parsed = notation.parse(state, notated);

      if (parsed && parsed.from === move.from && parsed.to === move.to) {
        roundTripSuccesses++;
      } else if (!gameFailed) {
        gameFailed = true;
        if (firstFailureIndex === null) {
          firstFailureIndex = g;
          firstFailureReason = `Notation round-trip failed: notated="${notated}", ` +
            `parsed=${parsed ? `${String(parsed.from)}-${String(parsed.to)}` : 'null'}, ` +
            `expected=${move.from}-${move.to}`;
        }
      }

      state = ruleSet.applyMove(state, move);
    }

    // Byte-identical serialization check.
    const reconstructedJson = JSON.stringify(ruleSet.serializer.toJSON(state));
    if (reconstructedJson !== game.finalStateJson) {
      allByteIdentical = false;
      if (!gameFailed) {
        gameFailed = true;
        if (firstFailureIndex === null) {
          firstFailureIndex = g;
          firstFailureReason = 'Serialization not byte-identical after replay';
        }
      }
    }

    if (gameFailed) {
      gamesFailed++;
    } else {
      gamesPassed++;
    }
  }

  return {
    gameId,
    gamesTested: corpus.length,
    gamesPassed,
    gamesFailed,
    firstFailureIndex,
    firstFailureReason,
    byteIdenticalSerialization: allByteIdentical,
    notationRoundTripRate: totalMoves > 0 ? roundTripSuccesses / totalMoves : 1,
    durationMs: performance.now() - startTime,
  };
}

/**
 * Runs replay round-trip validation for all Tier 1 variants.
 */
export function runAllTier1ReplayRoundTrip(
  gamesPerVariant = 5,
  seed = 42,
): readonly ReplayRoundTripReport[] {
  return TIER_1_DRAUGHTS_GAME_IDS.map((gameId) =>
    runClassifiedReplayRoundTrip(gameId, gamesPerVariant, seed),
  );
}
