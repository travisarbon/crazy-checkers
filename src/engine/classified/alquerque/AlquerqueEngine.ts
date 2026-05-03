/**
 * AlquerqueEngine ClassifiedRuleSet factory (Phase 4 Task 29.3).
 *
 * Assembles `types.ts` + `startingPosition.ts` + `moveGen.ts` + `applyMove.ts`
 * + `gameOver.ts` + `zammaSerializer.ts` into a single `ClassifiedRuleSet`
 * instance. Per-game registration with the worker registry, gallery, Career
 * tracker, and Cogitate adapter is the responsibility of Tasks 29.7 and
 * 29.G.5 — Task 29.3 only ships the headless rule set.
 *
 * Capability flags: every alquerque-engine game answers all six flags
 * `false` (Zamma has no placement phase, no hand reserves, no stacks, is
 * symmetric, has fixed geometry, and uses the trivial man/Mullah promotion).
 *
 * Ruleset family tag: `'alquerque'` (already a literal in the closed
 * `RuleSetFamilyTag` union).
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
import type {
  AlquerqueConfig,
  AlquerqueGameId,
  AlquerqueGameState,
  AlquerqueMove,
} from './types';
import { buildStartingState } from './startingPosition';
import { computeLegalMoves } from './moveGen';
import { applyAlquerqueMove } from './applyMove';
import { checkAlquerqueGameOver } from './gameOver';
import { createZammaSerializer } from './zammaSerializer';

const VOCAB_CACHE = new Map<AlquerqueGameId, PieceVocabulary>();

function vocabularyFor(gameId: AlquerqueGameId): PieceVocabulary {
  const cached = VOCAB_CACHE.get(gameId);
  if (cached) return cached;
  const vocab = createPieceVocabulary(
    asPieceVocabularyId(`alquerque-${gameId}`),
    [
      { pieceId: 'man', displayName: 'Man', promotesTo: 'mullah' },
      { pieceId: 'mullah', displayName: 'Mullah' },
    ],
    [],
  );
  VOCAB_CACHE.set(gameId, vocab);
  return vocab;
}

const FACTORY_CACHE = new WeakMap<
  AlquerqueConfig,
  ClassifiedRuleSet<ClassifiedGameState, AlquerqueMove>
>();

export function createAlquerqueRuleSet(
  config: AlquerqueConfig,
): ClassifiedRuleSet<ClassifiedGameState, AlquerqueMove> {
  const cached = FACTORY_CACHE.get(config);
  if (cached) return cached;
  const instance = build(config);
  FACTORY_CACHE.set(config, instance);
  return instance;
}

function build(
  config: AlquerqueConfig,
): ClassifiedRuleSet<ClassifiedGameState, AlquerqueMove> {
  const gameId: ClassifiedGameId = asClassifiedGameId(config.gameId);
  const pieceVocabulary = vocabularyFor(config.gameId);
  const serializer = createZammaSerializer(config) as unknown as
    import('../../../persistence/serializers/types').GameStateSerializer<ClassifiedGameState>;

  const startingPosition = (options?: StartOptions): ClassifiedGameState => {
    void options;
    return buildStartingState(config) as unknown as ClassifiedGameState;
  };

  const getLegalMoves = (state: ClassifiedGameState): readonly AlquerqueMove[] => {
    return computeLegalMoves(state, config);
  };

  const applyMove = (
    state: ClassifiedGameState,
    move: AlquerqueMove,
  ): ClassifiedGameState => {
    return applyAlquerqueMove(state as AlquerqueGameState, move, config) as unknown as ClassifiedGameState;
  };

  const checkGameOver = (state: ClassifiedGameState): GameResult | null => {
    return checkAlquerqueGameOver(state as AlquerqueGameState, config);
  };

  return {
    gameId,
    boardGeometry: config.boardGeometry,
    pieceVocabulary,
    ruleSetFamily: 'alquerque',
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
