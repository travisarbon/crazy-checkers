/**
 * Cheskers ClassifiedRuleSet factory (Phase 4 Task 29.6).
 *
 * Assembles all engine modules into a single `ClassifiedRuleSet` instance.
 * Per-game registration with the worker registry, gallery, Career tracker,
 * and Cogitate adapter is the responsibility of Tasks 29.7 and 29.G.10 —
 * Task 29.6 only ships the headless rule set.
 *
 * Capability flags: only `hasPiecesOfDistinctTypes: true` is set (Cheskers
 * has 4 distinct piece types per side: pawn, king, bishop, camel). All
 * other flags are `false`.
 *
 * Ruleset family tag: `'other'` (Cheskers is sui generis — neither pure
 * draughts nor pure chess; the `'hybrid'` ClassifiedFamily label is
 * surfaced at the per-game registration layer in Task 29.G.10).
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
  createCheskersConfig,
  type CheskersConfig,
  type CheskersGameState,
  type CheskersMove,
} from './types';
import { buildStartingState } from './startingPosition';
import { computeLegalMoves } from './moveGen';
import { applyCheskersMove } from './applyMove';
import { checkCheskersGameOver } from './gameOver';
import { createCheskersSerializer } from './cheskersSerializer';

let VOCAB_CACHE: PieceVocabulary | null = null;

function vocabulary(): PieceVocabulary {
  if (VOCAB_CACHE) return VOCAB_CACHE;
  VOCAB_CACHE = createPieceVocabulary(
    asPieceVocabularyId('cheskers-pieces'),
    [
      { pieceId: 'pawn', displayName: 'Pawn', promotesTo: 'king' },
      { pieceId: 'king', displayName: 'King' },
      { pieceId: 'bishop', displayName: 'Bishop' },
      { pieceId: 'camel', displayName: 'Camel' },
    ],
    [],
  );
  return VOCAB_CACHE;
}

let FACTORY_CACHE: ClassifiedRuleSet<ClassifiedGameState, CheskersMove> | null = null;

export function createCheskersRuleSet(): ClassifiedRuleSet<ClassifiedGameState, CheskersMove> {
  if (FACTORY_CACHE) return FACTORY_CACHE;
  FACTORY_CACHE = build(createCheskersConfig());
  return FACTORY_CACHE;
}

function build(
  config: CheskersConfig,
): ClassifiedRuleSet<ClassifiedGameState, CheskersMove> {
  const gameId: ClassifiedGameId = asClassifiedGameId(config.gameId);
  const pieceVocabulary = vocabulary();
  const serializer = createCheskersSerializer(config) as unknown as
    import('../../../persistence/serializers/types').GameStateSerializer<ClassifiedGameState>;

  const startingPosition = (options?: StartOptions): ClassifiedGameState => {
    void options;
    return buildStartingState(config) as unknown as ClassifiedGameState;
  };

  const getLegalMoves = (state: ClassifiedGameState): readonly CheskersMove[] => {
    return computeLegalMoves(state, config);
  };

  const applyMove = (
    state: ClassifiedGameState,
    move: CheskersMove,
  ): ClassifiedGameState => {
    return applyCheskersMove(state as CheskersGameState, move, config) as unknown as ClassifiedGameState;
  };

  const checkGameOver = (state: ClassifiedGameState): GameResult | null => {
    return checkCheskersGameOver(state as CheskersGameState, config);
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
    hasPiecesOfDistinctTypes: true,
    startingPosition,
    getLegalMoves,
    applyMove,
    checkGameOver,
    serializer,
  };
}
