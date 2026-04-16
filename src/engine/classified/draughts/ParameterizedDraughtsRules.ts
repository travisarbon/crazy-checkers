/**
 * ParameterizedDraughtsRules — the single behavioural engine for every Tier 1
 * Classified draughts variant (Task 28.2).
 *
 * Implements `ClassifiedRuleSet<ClassifiedGameState, DraughtsMove>` driven
 * solely by a frozen `DraughtsConfig`. Zero `gameId` branches: every
 * per-variant distinction is expressed through a config field, reflected in
 * one of the supporting modules (`moveGen`, `capturePriority`, `huffing`,
 * `repetition`). `createDraughtsRuleSet(config)` is the only symbol Task
 * 28.3 imports from this module.
 */

import type { NodeId } from '../../boardGeometry';
import type { GameResult } from '../../types';
import { GameResultType, GameEndReason } from '../../types';
import type {
  ClassifiedGameId,
  ClassifiedRuleSet,
  NotationAdapter,
  StartOptions,
} from '../ClassifiedRuleSet';
import { asClassifiedGameId } from '../ClassifiedRuleSet';
import type { ClassifiedGameState, ClassifiedPiece } from '../state';
import type { PieceVocabulary } from '../pieceVocabulary';
import { createPieceVocabulary, asPieceVocabularyId } from '../pieceVocabulary';
import { createDefaultSerializer } from '../../../persistence/serializers/default';
import type { DraughtsConfig } from './DraughtsConfig';
import { validateDraughtsConfig, boardSizeOf } from './DraughtsConfig';
import {
  generateJumpSequences,
  generateSimpleMoves,
  filterIllegalManCapturesKing,
  filterMaximumCapture,
  type DraughtsMove,
  type Owner,
  type PieceKind,
} from './moveGen';
import { filterByCapturePriority } from './capturePriority';
import { configToNotation } from './configToNotation';
import {
  hasThreefoldRepetition,
  hasQuietGameDraw,
  isKingIneligible,
  updateTracker,
  hashPosition,
  META_POSITION_HISTORY,
} from './repetition';

// ---------------------------------------------------------------------------
// Per-variant piece vocabulary
// ---------------------------------------------------------------------------

const TIER_1_PIECE_IDS: readonly string[] = ['man', 'king'];

function createTier1PieceVocabulary(gameId: string): PieceVocabulary {
  return createPieceVocabulary(
    asPieceVocabularyId(`draughts-tier-1-${gameId}`),
    [
      { pieceId: 'man', displayName: 'Man', promotesTo: 'king' },
      { pieceId: 'king', displayName: 'King' },
    ],
    [],
  );
}

// ---------------------------------------------------------------------------
// Factory cache
// ---------------------------------------------------------------------------

const factoryCache = new WeakMap<
  DraughtsConfig,
  ClassifiedRuleSet<ClassifiedGameState, DraughtsMove>
>();

export function createDraughtsRuleSet(
  config: DraughtsConfig,
): ClassifiedRuleSet<ClassifiedGameState, DraughtsMove> {
  const cached = factoryCache.get(config);
  if (cached) return cached;
  validateDraughtsConfig(config);
  const instance = buildRuleSet(config);
  factoryCache.set(config, instance);
  return instance;
}

function buildRuleSet(
  config: DraughtsConfig,
): ClassifiedRuleSet<ClassifiedGameState, DraughtsMove> {
  const gameId: ClassifiedGameId = asClassifiedGameId(config.gameId);
  const pieceVocabulary = createTier1PieceVocabulary(config.gameId);
  const serializer = createDefaultSerializer({
    gameId,
    vocabularyPieceIds: TIER_1_PIECE_IDS,
  });
  const notationAdapter = configToNotation(config) as NotationAdapter<
    ClassifiedGameState,
    DraughtsMove
  >;

  const startingPosition = (options?: StartOptions): ClassifiedGameState => {
    void options;
    return buildInitialState(config);
  };

  const getLegalMoves = (state: ClassifiedGameState): readonly DraughtsMove[] => {
    return computeLegalMoves(state, config);
  };

  const applyMove = (
    state: ClassifiedGameState,
    move: DraughtsMove,
  ): ClassifiedGameState => {
    return applyMoveImpl(state, move, config);
  };

  const checkGameOver = (state: ClassifiedGameState): GameResult | null => {
    return checkGameOverImpl(state, config);
  };

  return {
    gameId,
    boardGeometry: config.boardGeometry,
    pieceVocabulary,
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
    notationAdapter,
    serializer,
  };
}

// ---------------------------------------------------------------------------
// Starting position — delegates to Task 28.1 + seeds the repetition tracker.
// ---------------------------------------------------------------------------

import { generateStartingPosition } from './startingPositions';

function buildInitialState(config: DraughtsConfig): ClassifiedGameState {
  const base = generateStartingPosition(config);
  const initialHash = hashPosition(base);
  return {
    ...base,
    meta: {
      // kingMoveStreak is an array of [nodeId, count] tuples (Task 28.2.1 §4
      // per-king tracker). Absence of an entry means count = 0.
      kingMoveStreak: [],
      movesSinceCapture: 0,
      [META_POSITION_HISTORY]: [initialHash],
    },
  };
}

// ---------------------------------------------------------------------------
// getLegalMoves
// ---------------------------------------------------------------------------

function computeLegalMoves(
  state: ClassifiedGameState,
  config: DraughtsConfig,
): readonly DraughtsMove[] {
  const jumps = generateJumpSequences(state, config);
  const jumpsLegal = filterIllegalManCapturesKing(jumps, state, config);

  let jumpCandidates: readonly DraughtsMove[] = jumpsLegal;
  if (config.maximumCaptureMandatory) {
    jumpCandidates = filterMaximumCapture(jumpCandidates, state, config);
  }
  jumpCandidates = filterByCapturePriority(jumpCandidates, state, config);

  const simple = generateSimpleMoves(state, config);

  const unfiltered = config.captureObligatory && jumpCandidates.length > 0
    ? jumpCandidates
    : [...simple, ...jumpCandidates];

  return sortMoves(filterKingIneligibility(unfiltered, state, config));
}

/**
 * Task 28.2.1 §4 per-king 3-move filter.
 *
 * Removes moves originating at a king whose consecutive-move counter has
 * reached the config limit, unless the owner has only kings remaining
 * (the rule is waived in that case so the game doesn't stall).
 */
function filterKingIneligibility(
  moves: readonly DraughtsMove[],
  state: ClassifiedGameState,
  config: DraughtsConfig,
): readonly DraughtsMove[] {
  if (config.kingConsecutiveMoveLimit === null) return moves;
  const filtered = moves.filter((move) => {
    if (move.piece !== 'king') return true;
    const fromNode = config.boardGeometry.coordinateLabels.parseNotation(move.from);
    if (fromNode === null) return true;
    return !isKingIneligible(state, config, fromNode);
  });
  return filtered;
}

function sortMoves(moves: readonly DraughtsMove[]): readonly DraughtsMove[] {
  const copy = [...moves];
  copy.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    if (a.to !== b.to) return a.to < b.to ? -1 : 1;
    return b.capture.length - a.capture.length;
  });
  return copy;
}

// ---------------------------------------------------------------------------
// applyMove
// ---------------------------------------------------------------------------

function applyMoveImpl(
  state: ClassifiedGameState,
  move: DraughtsMove,
  config: DraughtsConfig,
): ClassifiedGameState {
  const fromNode = parseLabel(config, move.from);
  const toNode = parseLabel(config, move.to);
  const newPieces = new Map(state.pieces);

  // Remove captured pieces.
  for (const label of move.capture) {
    const nodeId = parseLabel(config, label);
    newPieces.delete(nodeId);
  }

  // Move mover.
  const mover = state.pieces.get(fromNode);
  if (!mover) {
    throw new Error(
      `[${config.gameId}] applyMove: no piece at ${move.from}`,
    );
  }
  newPieces.delete(fromNode);
  const kind: PieceKind = move.promotion === 'king' ? 'king' : (mover.kind as PieceKind);
  const placed: ClassifiedPiece = { owner: mover.owner, kind };
  newPieces.set(toNode, placed);

  const nextTurn: Owner = state.turn === 'white' ? 'black' : 'white';
  const nextState: ClassifiedGameState = {
    pieces: newPieces,
    turn: nextTurn,
    plyCount: (state.plyCount ?? 0) + 1,
    moveHistory: [...(state.moveHistory ?? []), move],
    ...(state.meta !== undefined ? { meta: state.meta } : {}),
  };
  return updateTracker(state, nextState, move, { fromNodeId: fromNode, toNodeId: toNode });
}

function parseLabel(config: DraughtsConfig, label: string): NodeId {
  const node = config.boardGeometry.coordinateLabels.parseNotation(label);
  if (node === null) {
    throw new Error(
      `[${config.gameId}] applyMove: unparsable notation token "${label}"`,
    );
  }
  return node;
}

// ---------------------------------------------------------------------------
// checkGameOver
// ---------------------------------------------------------------------------

function checkGameOverImpl(
  state: ClassifiedGameState,
  config: DraughtsConfig,
): GameResult | null {
  const turn = (state.turn ?? 'white') as Owner;
  const mover = turn;
  const opponent: Owner = mover === 'white' ? 'black' : 'white';

  // 1. Zero-piece check.
  let moverHas = false;
  let opponentHas = false;
  for (const piece of state.pieces.values()) {
    if (piece.owner === mover) moverHas = true;
    else if (piece.owner === opponent) opponentHas = true;
    if (moverHas && opponentHas) break;
  }
  if (!moverHas) return winFor(opponent, GameEndReason.NoPiecesLeft);
  if (!opponentHas) return winFor(mover, GameEndReason.NoPiecesLeft);

  // 2. No legal moves — active side loses. (Per-king 3-move ineligibility is
  // applied inside `computeLegalMoves`; if every king is ineligible and the
  // player has no alternative piece, the filter surfaces as an empty legal
  // move set and triggers this branch.)
  const moves = computeLegalMoves(state, config);
  if (moves.length === 0) {
    return winFor(opponent, GameEndReason.NoLegalMoves);
  }

  // 3. Threefold repetition.
  if (hasThreefoldRepetition(state)) {
    return draw(GameEndReason.Repetition);
  }

  // 4. 40-move no-capture rule.
  if (hasQuietGameDraw(state)) {
    return draw(GameEndReason.FortyMoveRule);
  }

  void boardSizeOf; // Retained reference for diagnostics; no runtime branch.
  return null;
}

function winFor(owner: Owner, reason: GameEndReason): GameResult {
  return {
    type: owner === 'white' ? GameResultType.WhiteWin : GameResultType.BlackWin,
    reason,
  };
}

function draw(reason: GameEndReason): GameResult {
  return { type: GameResultType.Draw, reason };
}
