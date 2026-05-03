/**
 * LinearMovementEngine ClassifiedRuleSet factory (Phase 4 Task 29.2).
 *
 * Assembles `types.ts` + `Phalanx.ts` + `moveGen.ts` + `applyMove.ts` +
 * `gameOver.ts` + `dameoSerializer.ts` into a single `ClassifiedRuleSet`
 * instance. Per-game registration with the worker registry, gallery, Career
 * tracker, and Cogitate adapter is the responsibility of Tasks 29.7 and
 * 29.G.1 — Task 29.2 only ships the headless rule set.
 *
 * Capability flags: every linear-movement game answers all six flags `false`
 * (Dameo has no placement phase, no hand reserves, no stacks, is symmetric,
 * has fixed geometry, and follows Tier 1's convention of treating
 * man/king as a single piece-type with promoted state).
 *
 * Ruleset family tag: `'other'` for the v1 enum. There is no `'linear'`
 * family label in the closed `RuleSetFamilyTag` union; we do not extend
 * the union for one game (Tier 5 reuses the same factory and would also
 * tag `'other'` until a coordinated change adds a `'linear'` label).
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
import {
  createDameoConfig,
  type LinearGameId,
  type LinearGameState,
  type LinearMove,
  type LinearMovementConfig,
} from './types';
import { buildStartingState } from './startingPosition';
import { computeLegalMoves } from './moveGen';
import { applyLinearMove } from './applyMove';
import { checkLinearGameOver } from './gameOver';
import { createDameoSerializer } from './dameoSerializer';

const VOCAB_CACHE = new Map<LinearGameId, PieceVocabulary>();

function vocabularyFor(gameId: LinearGameId): PieceVocabulary {
  const cached = VOCAB_CACHE.get(gameId);
  if (cached) return cached;
  const vocab = createPieceVocabulary(
    asPieceVocabularyId(`linear-${gameId}`),
    [
      { pieceId: 'man', displayName: 'Man', promotesTo: 'king' },
      { pieceId: 'king', displayName: 'King' },
    ],
    [],
  );
  VOCAB_CACHE.set(gameId, vocab);
  return vocab;
}

const FACTORY_CACHE = new WeakMap<
  LinearMovementConfig,
  ClassifiedRuleSet<ClassifiedGameState, LinearMove>
>();

export function createLinearMovementRuleSet(
  config: LinearMovementConfig,
): ClassifiedRuleSet<ClassifiedGameState, LinearMove> {
  const cached = FACTORY_CACHE.get(config);
  if (cached) return cached;
  const instance = build(config);
  FACTORY_CACHE.set(config, instance);
  return instance;
}

function build(
  config: LinearMovementConfig,
): ClassifiedRuleSet<ClassifiedGameState, LinearMove> {
  const gameId: ClassifiedGameId = asClassifiedGameId(config.gameId);
  const pieceVocabulary = vocabularyFor(config.gameId);
  const serializer = createDameoSerializer(config) as unknown as
    import('../../../persistence/serializers/types').GameStateSerializer<ClassifiedGameState>;

  const startingPosition = (options?: StartOptions): ClassifiedGameState => {
    void options;
    return buildStartingState(config) as unknown as ClassifiedGameState;
  };

  const getLegalMoves = (state: ClassifiedGameState): readonly LinearMove[] => {
    return computeLegalMoves(state, config);
  };

  const applyMove = (
    state: ClassifiedGameState,
    move: LinearMove,
  ): ClassifiedGameState => {
    return applyLinearMove(state as LinearGameState, move, config) as unknown as ClassifiedGameState;
  };

  const checkGameOver = (state: ClassifiedGameState): GameResult | null => {
    return checkLinearGameOver(state as LinearGameState, config);
  };

  return {
    gameId,
    boardGeometry: config.boardGeometry,
    pieceVocabulary,
    ruleSetFamily: 'other',
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

// ---------------------------------------------------------------------------
// Per-game convenience factory
// ---------------------------------------------------------------------------

export function createDameoRuleSet(): ClassifiedRuleSet<ClassifiedGameState, LinearMove> {
  return createLinearMovementRuleSet(createDameoConfig());
}
