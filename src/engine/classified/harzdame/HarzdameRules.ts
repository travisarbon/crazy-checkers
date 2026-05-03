/**
 * Harzdame ClassifiedRuleSet factory (Phase 4 Task 29.5).
 *
 * Assembles all engine modules into a single `ClassifiedRuleSet` instance.
 * Per-game registration with the worker registry, gallery, Career tracker,
 * and Cogitate adapter is the responsibility of Tasks 29.7 and 29.G.2 —
 * Task 29.5 only ships the headless rule set.
 *
 * Capability flags: all `false` (Harzdame is a standard symmetric draughts
 * variant despite its quirky mechanics; the `senior` promotion class is
 * encoded via the existing `ClassifiedPiece.promoted` field rather than as
 * a distinct piece kind, so `hasPiecesOfDistinctTypes: false`).
 *
 * Ruleset family tag: `'draughts'`.
 */

import type { GameResult } from '../../types';
import type {
  ClassifiedGameId,
  ClassifiedRuleSet,
  StartOptions,
} from '../ClassifiedRuleSet';
import { asClassifiedGameId } from '../ClassifiedRuleSet';
import type { ClassifiedGameState } from '../state';
import {
  asPieceVocabularyId,
  createPieceVocabulary,
  type PieceVocabulary,
} from '../pieceVocabulary';
import { createHarzdameConfig, type HarzdameConfig, type HarzdameGameState, type HarzdameMove } from './types';
import { buildStartingState } from './startingPosition';
import { computeLegalMoves, maxCaptureChainLength } from './moveGen';
import { applyHarzdameMove } from './applyMove';
import { checkHarzdameGameOver } from './gameOver';
import { createHarzdameSerializer } from './harzdameSerializer';

let VOCAB_CACHE: PieceVocabulary | null = null;

function vocabulary(): PieceVocabulary {
  if (VOCAB_CACHE) return VOCAB_CACHE;
  VOCAB_CACHE = createPieceVocabulary(
    asPieceVocabularyId('harzdame-pieces'),
    [
      { pieceId: 'man', displayName: 'Man', promotesTo: 'king' },
      { pieceId: 'king', displayName: 'King' },
      // Senior-king is an attribute (`promoted: true`) on a king piece, not
      // a distinct vocabulary entry. Per-game subtask 29.G.2-B may add a
      // bespoke visual for the senior class; the engine's vocabulary stays
      // simple.
    ],
    [],
  );
  return VOCAB_CACHE;
}

let FACTORY_CACHE: ClassifiedRuleSet<ClassifiedGameState, HarzdameMove> | null = null;

export function createHarzdameRuleSet(): ClassifiedRuleSet<ClassifiedGameState, HarzdameMove> {
  if (FACTORY_CACHE) return FACTORY_CACHE;
  FACTORY_CACHE = build(createHarzdameConfig());
  return FACTORY_CACHE;
}

function build(
  config: HarzdameConfig,
): ClassifiedRuleSet<ClassifiedGameState, HarzdameMove> {
  const gameId: ClassifiedGameId = asClassifiedGameId(config.gameId);
  const pieceVocabulary = vocabulary();
  const serializer = createHarzdameSerializer(config) as unknown as
    import('../../../persistence/serializers/types').GameStateSerializer<ClassifiedGameState>;

  const startingPosition = (options?: StartOptions): ClassifiedGameState => {
    void options;
    return buildStartingState(config) as unknown as ClassifiedGameState;
  };

  const getLegalMoves = (state: ClassifiedGameState): readonly HarzdameMove[] => {
    const moves = computeLegalMoves(state, config);
    // Cache the position-max chain length on the state's meta if it has
    // capture moves — applyMove reads this for senior-king flips. We can't
    // mutate the input state, so we attach the cache via the move records'
    // meta.maxChainLength field (used only by tests), and rely on
    // applyMove's fallback to recompute when the cache is missing.
    if (moves.some((m) => m.kind === 'capture')) {
      let max = 0;
      for (const m of moves) {
        if (m.capture.length > max) max = m.capture.length;
      }
      // Stamp each capture move with the position-max chain length so tests
      // can verify the cached value alongside the move.
      const stamped: HarzdameMove[] = moves.map((m) => {
        if (m.kind !== 'capture') return m;
        return {
          ...m,
          meta: { ...(m.meta ?? {}), maxChainLength: max },
        };
      });
      return stamped;
    }
    return moves;
  };

  const applyMove = (
    state: ClassifiedGameState,
    move: HarzdameMove,
  ): ClassifiedGameState => {
    // Compute pre-move max chain length and stash on state.meta if missing,
    // so applyMove can read it without re-running getLegalMoves.
    const stateWithCache: HarzdameGameState = {
      ...(state as HarzdameGameState),
      meta: {
        ...(state as HarzdameGameState).meta,
        maxCaptureChainLength: maxCaptureChainLength(state, config),
      },
    };
    return applyHarzdameMove(stateWithCache, move, config) as unknown as ClassifiedGameState;
  };

  const checkGameOver = (state: ClassifiedGameState): GameResult | null => {
    return checkHarzdameGameOver(state as HarzdameGameState, config);
  };

  return {
    gameId,
    boardGeometry: config.boardGeometry,
    pieceVocabulary,
    ruleSetFamily: 'draughts',
    hasPlacementPhase: false,
    hasPiecesInHand: false,
    hasStacks: false,
    isAsymmetric: false,
    hasMutableGeometry: false,
    hasPiecesOfDistinctTypes: false,
    startingPosition,
    getLegalMoves,
    applyMove,
    checkGameOver,
    serializer,
  };
}
