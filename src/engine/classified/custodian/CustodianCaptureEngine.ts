/**
 * CustodianCaptureEngine ClassifiedRuleSet factory (Phase 4 Task 29.4).
 *
 * Assembles `types.ts` + `startingPosition.ts` + `moveGen.ts` +
 * `applyMove.ts` + `gameOver.ts` + `custodianSerializer.ts` into a single
 * `ClassifiedRuleSet` instance. Per-game registration with the worker
 * registry, gallery, Career tracker, and Cogitate adapter is the
 * responsibility of Tasks 29.7 and 29.G.6 / 29.G.7 / 29.G.8 / 29.G.9 —
 * Task 29.4 only ships the headless rule sets.
 *
 * Capability flags: all `false` for Mak-yek, Hasami Shogi, Dai Hasami.
 * Rek's `hasPiecesOfDistinctTypes` is `true` (Men + 1 King).
 *
 * Ruleset family tag: `'custodian'`.
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
  CustodianConfig,
  CustodianGameId,
  CustodianGameState,
  CustodianMove,
} from './types';
import { buildStartingState } from './startingPosition';
import { computeLegalMoves } from './moveGen';
import { applyCustodianMove } from './applyMove';
import { checkCustodianGameOver } from './gameOver';
import { createCustodianSerializer } from './custodianSerializer';

const VOCAB_CACHE = new Map<CustodianGameId, PieceVocabulary>();

function vocabularyFor(config: CustodianConfig): PieceVocabulary {
  const cached = VOCAB_CACHE.get(config.gameId);
  if (cached) return cached;
  const includesKing = config.pieceTypes.includes('king');
  const onBoard = [
    { pieceId: 'man', displayName: 'Man' },
    ...(includesKing ? [{ pieceId: 'king', displayName: 'King' }] : []),
  ];
  const vocab = createPieceVocabulary(
    asPieceVocabularyId(`custodian-${config.gameId}`),
    onBoard,
    [],
  );
  VOCAB_CACHE.set(config.gameId, vocab);
  return vocab;
}

const FACTORY_CACHE = new WeakMap<
  CustodianConfig,
  ClassifiedRuleSet<ClassifiedGameState, CustodianMove>
>();

export function createCustodianRuleSet(
  config: CustodianConfig,
): ClassifiedRuleSet<ClassifiedGameState, CustodianMove> {
  const cached = FACTORY_CACHE.get(config);
  if (cached) return cached;
  const instance = build(config);
  FACTORY_CACHE.set(config, instance);
  return instance;
}

function build(
  config: CustodianConfig,
): ClassifiedRuleSet<ClassifiedGameState, CustodianMove> {
  const gameId: ClassifiedGameId = asClassifiedGameId(config.gameId);
  const pieceVocabulary = vocabularyFor(config);
  const serializer = createCustodianSerializer(config) as unknown as
    import('../../../persistence/serializers/types').GameStateSerializer<ClassifiedGameState>;

  const startingPosition = (options?: StartOptions): ClassifiedGameState => {
    void options;
    return buildStartingState(config) as unknown as ClassifiedGameState;
  };

  const getLegalMoves = (state: ClassifiedGameState): readonly CustodianMove[] => {
    return computeLegalMoves(state, config);
  };

  const applyMove = (
    state: ClassifiedGameState,
    move: CustodianMove,
  ): ClassifiedGameState => {
    return applyCustodianMove(state as CustodianGameState, move, config) as unknown as ClassifiedGameState;
  };

  const checkGameOver = (state: ClassifiedGameState): GameResult | null => {
    return checkCustodianGameOver(state as CustodianGameState, config);
  };

  return {
    gameId,
    boardGeometry: config.boardGeometry,
    pieceVocabulary,
    ruleSetFamily: 'custodian',
    hasPlacementPhase: false,
    hasPiecesInHand: false,
    hasStacks: false,
    isAsymmetric: false,
    hasMutableGeometry: false,
    hasPiecesOfDistinctTypes: config.pieceTypes.includes('king'),
    startingPosition,
    getLegalMoves,
    applyMove,
    checkGameOver,
    serializer,
  };
}
