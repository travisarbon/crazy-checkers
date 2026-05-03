/**
 * Stacking-draughts ClassifiedRuleSet factory (Phase 4 Task 29.1).
 *
 * Assembles `types.ts` + `moveGen.ts` + `applyMove.ts` + `gameOver.ts` +
 * `stackingSerializer.ts` into a single `ClassifiedRuleSet` per game (Lasca,
 * Bashni). Per-game registration with the worker registry, gallery, Career
 * tracker, and Cogitate adapter is the responsibility of Tasks 29.7,
 * 29.G.3, and 29.G.4 — Task 29.1 only ships the headless rule set.
 *
 * Capability flags: every Tier 2 stacking game answers
 * `hasStacks: true` and every other capability flag `false`.
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
  createBashniConfig,
  createLascaConfig,
  type StackingDraughtsConfig,
  type StackingGameId,
  type StackingGameState,
  type StackingMove,
} from './types';
import { buildStartingState } from './startingPosition';
import { computeLegalMoves } from './moveGen';
import { applyStackingMove } from './applyMove';
import { checkStackingGameOver } from './gameOver';
import { createStackingSerializer } from './stackingSerializer';

const VOCAB_CACHE = new Map<StackingGameId, PieceVocabulary>();

function vocabularyFor(gameId: StackingGameId): PieceVocabulary {
  const cached = VOCAB_CACHE.get(gameId);
  if (cached) return cached;
  const vocab = createPieceVocabulary(
    asPieceVocabularyId(`stacking-${gameId}`),
    [
      { pieceId: 'man', displayName: 'Soldier', promotesTo: 'king' },
      { pieceId: 'king', displayName: 'Officer' },
    ],
    [],
  );
  VOCAB_CACHE.set(gameId, vocab);
  return vocab;
}

const FACTORY_CACHE = new WeakMap<
  StackingDraughtsConfig,
  ClassifiedRuleSet<ClassifiedGameState, StackingMove>
>();

export function createStackingDraughtsRuleSet(
  config: StackingDraughtsConfig,
): ClassifiedRuleSet<ClassifiedGameState, StackingMove> {
  const cached = FACTORY_CACHE.get(config);
  if (cached) return cached;
  const instance = build(config);
  FACTORY_CACHE.set(config, instance);
  return instance;
}

function build(
  config: StackingDraughtsConfig,
): ClassifiedRuleSet<ClassifiedGameState, StackingMove> {
  const gameId: ClassifiedGameId = asClassifiedGameId(config.gameId);
  const pieceVocabulary = vocabularyFor(config.gameId);
  const serializer = createStackingSerializer(config) as unknown as
    import('../../../persistence/serializers/types').GameStateSerializer<ClassifiedGameState>;

  const startingPosition = (options?: StartOptions): ClassifiedGameState => {
    void options;
    return buildStartingState(config) as unknown as ClassifiedGameState;
  };

  const getLegalMoves = (state: ClassifiedGameState): readonly StackingMove[] => {
    return computeLegalMoves(state, config);
  };

  const applyMove = (
    state: ClassifiedGameState,
    move: StackingMove,
  ): ClassifiedGameState => {
    return applyStackingMove(state as StackingGameState, move, config) as unknown as ClassifiedGameState;
  };

  const checkGameOver = (state: ClassifiedGameState): GameResult | null => {
    return checkStackingGameOver(state as StackingGameState, config);
  };

  return {
    gameId,
    boardGeometry: config.boardGeometry,
    pieceVocabulary,
    ruleSetFamily: 'stacking',
    hasPlacementPhase: false,
    hasPiecesInHand: false,
    hasStacks: true,
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
// Per-game convenience factories
// ---------------------------------------------------------------------------

export function createLascaRuleSet(): ClassifiedRuleSet<ClassifiedGameState, StackingMove> {
  return createStackingDraughtsRuleSet(createLascaConfig());
}

export function createBashniRuleSet(): ClassifiedRuleSet<ClassifiedGameState, StackingMove> {
  return createStackingDraughtsRuleSet(createBashniConfig());
}
