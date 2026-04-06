// src/ui/useEventAnimations.ts
//
// Hook that provides functions to build animation step sequences for event
// triggers and expirations. Encapsulates the mapping from CrazyEvent type
// to animation choreography.

import { useCallback } from 'react';
import type { ActiveEvent, BoardState, Move, Square } from '../engine/types';
import { CrazyEvent, PieceColor, PieceType, square } from '../engine/types';
import { getBoardSquare, squareToGrid, gridToSquare } from '../engine/board';
import { getMostAdvancedPieceSquare } from '../engine/events/forcedMarch';
import { isEdgeSquare } from '../engine/events/quicksand';
import { SAFE_HAVEN_SQUARES } from '../engine/events/safeHaven';
import type { AnimationStep } from './useAnimationQueue';
import { EVENT_ANIM_DURATION, ANIM_DURATION, ANIM_EASING } from './useAnimationQueue';

const SHUFFLE_TOTAL =
  EVENT_ANIM_DURATION.SHUFFLE_LIFT +
  EVENT_ANIM_DURATION.SHUFFLE_SCATTER +
  EVENT_ANIM_DURATION.SHUFFLE_SETTLE;

// ---------------------------------------------------------------------------
// Helper functions (module-private)
// ---------------------------------------------------------------------------

/** Get all squares containing pawns (either color). */
export function getAllPawnSquares(board: BoardState): Square[] {
  const squares: Square[] = [];
  for (let sq = 1; sq <= 32; sq++) {
    const piece = getBoardSquare(board, square(sq));
    if (piece && piece.type === PieceType.Pawn) {
      squares.push(square(sq));
    }
  }
  return squares;
}

/** Get all squares containing kings (either color). */
export function getAllKingSquares(board: BoardState): Square[] {
  const squares: Square[] = [];
  for (let sq = 1; sq <= 32; sq++) {
    const piece = getBoardSquare(board, square(sq));
    if (piece && piece.type === PieceType.King) {
      squares.push(square(sq));
    }
  }
  return squares;
}

/** Get all occupied squares. */
export function getAllOccupiedSquares(board: BoardState): Square[] {
  const squares: Square[] = [];
  for (let sq = 1; sq <= 32; sq++) {
    if (getBoardSquare(board, square(sq))) {
      squares.push(square(sq));
    }
  }
  return squares;
}

/** Get diagonal neighbor squares of a given square. */
export function getDiagonalNeighbors(sq: Square): Square[] {
  const { row, col } = squareToGrid(sq);
  const neighbors: Square[] = [];
  for (const [dr, dc] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ] as const) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const nsq = gridToSquare(nr, nc);
      if (nsq !== null) neighbors.push(nsq);
    }
  }
  return neighbors;
}

// ---------------------------------------------------------------------------
// Per-event activation builders
// ---------------------------------------------------------------------------

function buildKingForADayActivation(
  _event: ActiveEvent,
  board: BoardState,
): AnimationStep[] {
  const pawnSquares = getAllPawnSquares(board);

  return [
    {
      type: 'flash',
      squares: pawnSquares,
      color: 'var(--ui-accent)',
      durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 3,
      pulses: 3,
    },
  ];
}

function buildLiveGrenadeActivation(): AnimationStep[] {
  return [];
}

function buildHotPotatoActivation(): AnimationStep[] {
  return [];
}

function buildChecksMixActivation(
  boardBefore: BoardState,
  boardAfter: BoardState,
): AnimationStep[] {
  const fromPositions = new Map<number, { color: PieceColor; type: PieceType }>();
  const toPositions = new Map<number, { color: PieceColor; type: PieceType }>();

  for (let sq = 1; sq <= 32; sq++) {
    const pieceBefore = getBoardSquare(boardBefore, square(sq));
    const pieceAfter = getBoardSquare(boardAfter, square(sq));
    if (pieceBefore) {
      fromPositions.set(sq, { color: pieceBefore.color, type: pieceBefore.type });
    }
    if (pieceAfter) {
      toPositions.set(sq, { color: pieceAfter.color, type: pieceAfter.type });
    }
  }

  return [
    {
      type: 'shuffle',
      fromPositions,
      toPositions,
      durationMs: SHUFFLE_TOTAL,
    },
  ];
}

function buildOppositeDayActivation(board: BoardState): AnimationStep[] {
  const occupiedSquares = getAllOccupiedSquares(board);

  return [
    {
      type: 'flash',
      squares: occupiedSquares,
      color: 'var(--ui-danger)',
      durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2,
      pulses: 2,
    },
  ];
}

function buildUpInTheAirActivation(board: BoardState): AnimationStep[] {
  const allPieceSquares = getAllOccupiedSquares(board);

  return [
    {
      type: 'flash',
      squares: allPieceSquares,
      color: 'var(--ui-accent)',
      durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2,
      pulses: 2,
    },
  ];
}

/** Get all occupied edge squares. */
export function getOccupiedEdgeSquares(board: BoardState): Square[] {
  const squares: Square[] = [];
  for (let sq = 1; sq <= 32; sq++) {
    if (getBoardSquare(board, square(sq)) && isEdgeSquare(sq)) {
      squares.push(square(sq));
    }
  }
  return squares;
}

/** Get the 4 fixed safe haven squares. */
export function getSafeHavenSquares(): Square[] {
  return [...SAFE_HAVEN_SQUARES].map(n => square(n));
}

/** Get all dark squares in the expanded promotion zone (rows 0, 1, 6, 7). */
export function getExpandedPromotionSquares(): Square[] {
  const squares: Square[] = [];
  for (let sq = 1; sq <= 32; sq++) {
    const { row } = squareToGrid(square(sq));
    if (row <= 1 || row >= 6) squares.push(square(sq));
  }
  return squares;
}

// -- Tier 1 Batch 1 activation builders --

function buildStepBackActivation(board: BoardState): AnimationStep[] {
  return [{
    type: 'flash', squares: getAllPawnSquares(board),
    color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2,
  }];
}

function buildDealersChoiceActivation(board: BoardState): AnimationStep[] {
  return [{
    type: 'flash', squares: getAllOccupiedSquares(board),
    color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2,
  }];
}

function buildBodyguardActivation(board: BoardState): AnimationStep[] {
  return [{
    type: 'flash', squares: getAllKingSquares(board),
    color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2,
  }];
}

function buildQuicksandActivation(board: BoardState): AnimationStep[] {
  return [{
    type: 'flash', squares: getOccupiedEdgeSquares(board),
    color: 'var(--ui-danger)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2,
  }];
}

function buildFrozenAssetsActivation(board: BoardState): AnimationStep[] {
  const kingSquares = getAllKingSquares(board);
  return [
    { type: 'flash', squares: kingSquares, color: 'var(--ui-danger)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 },
    { type: 'flash', squares: kingSquares, color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 },
  ];
}

function buildSafeHavenActivation(): AnimationStep[] {
  return [{
    type: 'flash', squares: getSafeHavenSquares(),
    color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2,
  }];
}

// -- Tier 1 Batch 2 activation builders --

function buildPromotionPartyActivation(): AnimationStep[] {
  return [{
    type: 'flash', squares: getExpandedPromotionSquares(),
    color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2,
  }];
}

function buildDemotionActivation(board: BoardState): AnimationStep[] {
  return [{
    type: 'flash', squares: getAllKingSquares(board),
    color: 'var(--ui-danger)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2,
  }];
}

function buildForcedMarchActivation(event: ActiveEvent, board: BoardState): AnimationStep[] {
  const allOccupied = getAllOccupiedSquares(board);
  const steps: AnimationStep[] = [
    { type: 'flash', squares: allOccupied, color: 'var(--ui-danger)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2 },
  ];
  const advanced = getMostAdvancedPieceSquare(board, event.triggeredBy);
  if (advanced !== null) {
    steps.push({ type: 'flash', squares: [advanced], color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 });
  }
  return steps;
}

function buildRoyalDecreeActivation(board: BoardState): AnimationStep[] {
  const kingSquares = getAllKingSquares(board);
  const pawnSquares = getAllPawnSquares(board);
  const steps: AnimationStep[] = [];
  if (kingSquares.length > 0) {
    steps.push({ type: 'flash', squares: kingSquares, color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2 });
  }
  if (pawnSquares.length > 0) {
    steps.push({ type: 'flash', squares: pawnSquares, color: 'var(--ui-danger)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2 });
  }
  return steps;
}

function buildSentryActivation(board: BoardState): AnimationStep[] {
  return [{
    type: 'flash', squares: getAllKingSquares(board),
    color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2,
  }];
}

function buildRushHourActivation(board: BoardState): AnimationStep[] {
  return [{
    type: 'flash', squares: getAllPawnSquares(board),
    color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2,
  }];
}

// -- Tier 1 expiry builders --

function buildStepBackExpiration(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllPawnSquares(board), color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 }];
}

function buildDealersChoiceExpiration(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllOccupiedSquares(board), color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 }];
}

function buildBodyguardExpiration(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllKingSquares(board), color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 }];
}

function buildQuicksandExpiration(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getOccupiedEdgeSquares(board), color: 'var(--ui-danger)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 }];
}

function buildFrozenAssetsExpiration(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllKingSquares(board), color: 'var(--ui-danger)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 }];
}

function buildSafeHavenExpiration(): AnimationStep[] {
  return [{ type: 'flash', squares: getSafeHavenSquares(), color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 }];
}

function buildPromotionPartyExpiration(): AnimationStep[] {
  return [{ type: 'flash', squares: getExpandedPromotionSquares(), color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 }];
}

function buildForcedMarchExpiration(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllOccupiedSquares(board), color: 'var(--ui-danger)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 }];
}

function buildRoyalDecreeExpiration(board: BoardState): AnimationStep[] {
  const steps: AnimationStep[] = [];
  const kings = getAllKingSquares(board);
  const pawns = getAllPawnSquares(board);
  if (kings.length > 0) steps.push({ type: 'flash', squares: kings, color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 });
  if (pawns.length > 0) steps.push({ type: 'flash', squares: pawns, color: 'var(--ui-danger)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 });
  return steps;
}

function buildSentryExpiration(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllKingSquares(board), color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 }];
}

function buildRushHourExpiration(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllPawnSquares(board), color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 }];
}

function buildNoTouchingActivation(board: BoardState): AnimationStep[] {
  const kingSquares = getAllKingSquares(board);

  return [
    {
      type: 'flash',
      squares: kingSquares,
      color: 'var(--ui-accent)',
      durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2,
      pulses: 2,
    },
  ];
}

// ---------------------------------------------------------------------------
// Per-event mid-move effect builders
// ---------------------------------------------------------------------------

function buildLiveGrenadeDetonation(
  move: Move,
  boardBefore: BoardState,
  boardAfter: BoardState,
): AnimationStep[] {
  const landingSquare = move.path[move.path.length - 1];
  if (landingSquare === undefined) return [];

  const diagonalNeighbors = getDiagonalNeighbors(landingSquare);
  const affectedSquares = [landingSquare, ...diagonalNeighbors];

  // Identify which affected squares had pieces destroyed (compare board before/after)
  const destroyedSquares = diagonalNeighbors.filter(
    (sq) => getBoardSquare(boardBefore, sq) !== null && getBoardSquare(boardAfter, sq) === null,
  );

  const steps: AnimationStep[] = [
    {
      type: 'explosion',
      centerSquare: landingSquare,
      affectedSquares,
      durationMs: EVENT_ANIM_DURATION.EXPLOSION,
    },
  ];

  // Fade out destroyed adjacent pieces
  for (const sq of destroyedSquares) {
    steps.push({
      type: 'fadeOut',
      square: sq,
      durationMs: ANIM_DURATION.CAPTURE_FADE,
      easing: ANIM_EASING.CAPTURE_FADE,
    });
  }

  return steps;
}

function buildHotPotatoEffect(move: Move, event: ActiveEvent): AnimationStep[] {
  const landingSquare = move.path[move.path.length - 1];
  if (landingSquare === undefined) return [];

  return [
    {
      type: 'colorSwap',
      square: landingSquare,
      fromColor: event.triggeredBy === PieceColor.White ? PieceColor.White : PieceColor.Black,
      toColor: event.triggeredBy === PieceColor.White ? PieceColor.Black : PieceColor.White,
      durationMs: EVENT_ANIM_DURATION.COLOR_SWAP,
    },
  ];
}

// ---------------------------------------------------------------------------
// Per-event expiration builders
// ---------------------------------------------------------------------------

function buildKingForADayExpiration(
  _event: ActiveEvent,
  board: BoardState,
): AnimationStep[] {
  const pawnSquares = getAllPawnSquares(board);

  return [
    {
      type: 'flash',
      squares: pawnSquares,
      color: 'var(--ui-accent)',
      durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2,
      pulses: 2,
    },
  ];
}

function buildOppositeDayExpiration(board: BoardState): AnimationStep[] {
  const occupiedSquares = getAllOccupiedSquares(board);

  return [
    {
      type: 'flash',
      squares: occupiedSquares,
      color: 'var(--ui-danger)',
      durationMs: EVENT_ANIM_DURATION.FLASH_PULSE,
      pulses: 1,
    },
  ];
}

function buildUpInTheAirExpiration(board: BoardState): AnimationStep[] {
  const allPieceSquares = getAllOccupiedSquares(board);

  return [
    {
      type: 'flash',
      squares: allPieceSquares,
      color: 'var(--ui-accent)',
      durationMs: EVENT_ANIM_DURATION.FLASH_PULSE,
      pulses: 1,
    },
  ];
}

// ---------------------------------------------------------------------------
// Tier 2/3 activation builders (Task 16.5)
// ---------------------------------------------------------------------------

function buildConscriptionActivation(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllOccupiedSquares(board), color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2 }];
}

function buildGhostWalkActivation(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllOccupiedSquares(board), color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2 }];
}

function buildLandmineActivation(): AnimationStep[] {
  const mineSquares = [14, 15, 18, 19].map(n => square(n));
  return [{ type: 'flash', squares: mineSquares, color: 'var(--ui-danger)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 3, pulses: 3 }];
}

function buildLeapfrogActivation(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllOccupiedSquares(board), color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2 }];
}

function buildDoubleTimeActivation(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllOccupiedSquares(board), color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2 }];
}

function buildChainReactionActivation(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllOccupiedSquares(board), color: 'var(--ui-danger)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2 }];
}

function buildReinforcementsActivation(boardBefore: BoardState, boardAfter: BoardState): AnimationStep[] {
  const newSquares: Square[] = [];
  for (let sq = 1; sq <= 32; sq++) {
    if (getBoardSquare(boardBefore, square(sq)) === null && getBoardSquare(boardAfter, square(sq)) !== null) {
      newSquares.push(square(sq));
    }
  }
  if (newSquares.length === 0) return [];
  return [{ type: 'flash', squares: newSquares, color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2 }];
}

function buildWormholeActivation(event: ActiveEvent): AnimationStep[] {
  const meta = event.metadata as { wormholes?: ReadonlyArray<{ a: number; b: number }> } | undefined;
  if (!meta?.wormholes) return [];
  const squares = meta.wormholes.flatMap(p => [square(p.a), square(p.b)]);
  return [{ type: 'flash', squares, color: 'rgba(255, 165, 0, 0.6)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 3, pulses: 3 }];
}

function buildTimeBombActivation(event: ActiveEvent): AnimationStep[] {
  const meta = event.metadata as { bombSquare?: number } | undefined;
  if (!meta?.bombSquare || meta.bombSquare < 0) return [];
  return [{ type: 'flash', squares: [square(meta.bombSquare)], color: 'var(--ui-danger)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 3, pulses: 3 }];
}

function buildRicochetActivation(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllOccupiedSquares(board), color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2 }];
}

function buildCrownThiefActivation(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllPawnSquares(board), color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2 }];
}

function buildStampedeActivation(boardBefore: BoardState, boardAfter: BoardState): AnimationStep[] {
  const fromPositions = new Map<number, { color: PieceColor; type: PieceType }>();
  const toPositions = new Map<number, { color: PieceColor; type: PieceType }>();
  for (let sq = 1; sq <= 32; sq++) {
    const before = getBoardSquare(boardBefore, square(sq));
    const after = getBoardSquare(boardAfter, square(sq));
    if (before) fromPositions.set(sq, { color: before.color, type: before.type });
    if (after) toPositions.set(sq, { color: after.color, type: after.type });
  }
  return [{ type: 'shuffle', fromPositions, toPositions, durationMs: SHUFFLE_TOTAL }];
}

function buildTollRoadActivation(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllOccupiedSquares(board), color: 'var(--ui-danger)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2 }];
}

function buildSwapMeetActivation(boardBefore: BoardState, boardAfter: BoardState): AnimationStep[] {
  const fromPositions = new Map<number, { color: PieceColor; type: PieceType }>();
  const toPositions = new Map<number, { color: PieceColor; type: PieceType }>();
  for (let sq = 1; sq <= 32; sq++) {
    const before = getBoardSquare(boardBefore, square(sq));
    const after = getBoardSquare(boardAfter, square(sq));
    if (before) fromPositions.set(sq, { color: before.color, type: before.type });
    if (after) toPositions.set(sq, { color: after.color, type: after.type });
  }
  return [{ type: 'shuffle', fromPositions, toPositions, durationMs: SHUFFLE_TOTAL }];
}

function buildBackfireActivation(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllOccupiedSquares(board), color: 'var(--ui-danger)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2 }];
}

function buildSacrificeActivation(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllOccupiedSquares(board), color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2 }];
}

function buildFlippedScriptActivation(boardBefore: BoardState, boardAfter: BoardState): AnimationStep[] {
  // Find pawns promoted by the flip
  const promotedSquares: Square[] = [];
  for (let sq = 1; sq <= 32; sq++) {
    const before = getBoardSquare(boardBefore, square(sq));
    const after = getBoardSquare(boardAfter, square(sq));
    if (before?.type === PieceType.Pawn && after?.type === PieceType.King) {
      promotedSquares.push(square(sq));
    }
  }
  const steps: AnimationStep[] = [
    { type: 'flash', squares: getAllOccupiedSquares(boardBefore), color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2 },
  ];
  for (const sq of promotedSquares) {
    steps.push({ type: 'kingPulse', square: sq, durationMs: ANIM_DURATION.KING_PULSE });
  }
  return steps;
}

function buildMarchingOrdersActivation(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllOccupiedSquares(board), color: 'rgba(255, 165, 0, 0.6)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 3, pulses: 3 }];
}

function buildHauntedActivation(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllOccupiedSquares(board), color: 'var(--ui-danger)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 2, pulses: 2 }];
}

function buildShrinkingBoardActivation(): AnimationStep[] {
  const ring0: Square[] = [];
  for (let sq = 1; sq <= 32; sq++) {
    const { row, col } = squareToGrid(square(sq));
    if (Math.min(row, 7 - row, col, 7 - col) === 0) ring0.push(square(sq));
  }
  return [{ type: 'flash', squares: ring0, color: 'var(--ui-danger)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 3, pulses: 3 }];
}

// ---------------------------------------------------------------------------
// Tier 2/3 expiry builders (Task 16.5)
// ---------------------------------------------------------------------------

function buildGenericAccentExpiry(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllOccupiedSquares(board), color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 }];
}

function buildGenericDangerExpiry(board: BoardState): AnimationStep[] {
  return [{ type: 'flash', squares: getAllOccupiedSquares(board), color: 'var(--ui-danger)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 }];
}

// ---------------------------------------------------------------------------
// Tier 2/3 mid-move effect builders (Task 16.5)
// ---------------------------------------------------------------------------

function buildConscriptionEffect(move: Move, boardBefore: BoardState, boardAfter: BoardState): AnimationStep[] {
  const steps: AnimationStep[] = [];
  for (const capSq of move.captured) {
    const before = getBoardSquare(boardBefore, capSq);
    const after = getBoardSquare(boardAfter, capSq);
    if (before && after && before.color !== after.color) {
      steps.push({ type: 'colorSwap', square: capSq, fromColor: before.color, toColor: after.color, durationMs: 400 });
    }
  }
  return steps;
}

function buildChainReactionEffect(move: Move, boardBefore: BoardState, boardAfter: BoardState): AnimationStep[] {
  const captured = new Set(move.captured.map(s => s as number));
  const cascaded: Square[] = [];
  for (let sq = 1; sq <= 32; sq++) {
    if (captured.has(sq)) continue;
    if (getBoardSquare(boardBefore, square(sq)) !== null && getBoardSquare(boardAfter, square(sq)) === null) {
      cascaded.push(square(sq));
    }
  }
  if (cascaded.length === 0) return [];
  const landingSquare = move.path[move.path.length - 1];
  const steps: AnimationStep[] = [];
  if (landingSquare !== undefined) {
    steps.push({ type: 'explosion', centerSquare: landingSquare, affectedSquares: cascaded, durationMs: 600 });
  }
  for (const sq of cascaded) {
    steps.push({ type: 'fadeOut', square: sq, durationMs: 200 });
  }
  return steps;
}

function buildLandmineEffect(move: Move, boardBefore: BoardState, boardAfter: BoardState): AnimationStep[] {
  const landing = move.path[move.path.length - 1];
  if (landing === undefined) return [];
  const mineSquares = new Set([14, 15, 18, 19]);
  if (!mineSquares.has(landing as number)) return [];
  if (getBoardSquare(boardBefore, landing) !== null || getBoardSquare(boardAfter, landing) !== null) return [];
  // Piece was destroyed by mine (it was placed by applyMove then removed by onTurnEnd)
  // Actually, we detect: piece moved to a mine square and is now gone
  return [
    { type: 'explosion', centerSquare: landing, affectedSquares: [landing], durationMs: 600 },
  ];
}

function buildCrownThiefEffect(move: Move, boardBefore: BoardState, boardAfter: BoardState): AnimationStep[] {
  if (move.captured.length === 0) return [];
  const movingPiece = getBoardSquare(boardBefore, move.from);
  if (!movingPiece || movingPiece.type !== PieceType.Pawn) return [];
  const landing = move.path[move.path.length - 1];
  if (landing === undefined) return [];
  const landingPiece = getBoardSquare(boardAfter, landing);
  if (landingPiece?.type === PieceType.King) {
    return [{ type: 'kingPulse', square: landing, durationMs: ANIM_DURATION.KING_PULSE }];
  }
  return [];
}

function buildTollRoadEffect(move: Move, boardBefore: BoardState, boardAfter: BoardState): AnimationStep[] {
  if (move.captured.length === 0) return [];
  const capturedSet = new Set(move.captured.map(s => s as number));
  const landing = move.path[move.path.length - 1];
  const landingNum = landing as number | undefined;
  // Find a square where the active player lost a piece that wasn't captured or the landing
  for (let sq = 1; sq <= 32; sq++) {
    if (capturedSet.has(sq)) continue;
    if (sq === landingNum) continue;
    const before = getBoardSquare(boardBefore, square(sq));
    const after = getBoardSquare(boardAfter, square(sq));
    if (before !== null && after === null) {
      return [
        { type: 'flash', squares: [square(sq)], color: 'var(--ui-danger)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 },
        { type: 'fadeOut', square: square(sq), durationMs: 200 },
      ];
    }
  }
  return [];
}

function buildSacrificeEffect(boardBefore: BoardState, boardAfter: BoardState): AnimationStep[] {
  // Find squares where a pawn became a king (for the non-active/defender color)
  const steps: AnimationStep[] = [];
  for (let sq = 1; sq <= 32; sq++) {
    const before = getBoardSquare(boardBefore, square(sq));
    const after = getBoardSquare(boardAfter, square(sq));
    if (before?.type === PieceType.Pawn && after?.type === PieceType.King && before.color === after.color) {
      steps.push(
        { type: 'flash', squares: [square(sq)], color: 'var(--ui-accent)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 },
        { type: 'kingPulse', square: square(sq), durationMs: ANIM_DURATION.KING_PULSE },
      );
    }
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Dispatchers
// ---------------------------------------------------------------------------

function buildActivationForEvent(
  event: ActiveEvent,
  board: BoardState,
  boardAfter?: BoardState,
): AnimationStep[] {
  switch (event.type) {
    case CrazyEvent.KingForADay:
      return buildKingForADayActivation(event, board);
    case CrazyEvent.LiveGrenade:
      return buildLiveGrenadeActivation();
    case CrazyEvent.HotPotato:
      return buildHotPotatoActivation();
    case CrazyEvent.ChecksMix:
      return boardAfter ? buildChecksMixActivation(board, boardAfter) : [];
    case CrazyEvent.OppositeDay:
      return buildOppositeDayActivation(board);
    case CrazyEvent.UpInTheAir:
      return buildUpInTheAirActivation(board);
    case CrazyEvent.NoTouching:
      return buildNoTouchingActivation(board);
    // Phase 3 — Task 15.1 (Tier 1 Batch 1)
    case CrazyEvent.StepBack:
      return buildStepBackActivation(board);
    case CrazyEvent.DealersChoice:
      return buildDealersChoiceActivation(board);
    case CrazyEvent.Bodyguard:
      return buildBodyguardActivation(board);
    case CrazyEvent.Quicksand:
      return buildQuicksandActivation(board);
    case CrazyEvent.FrozenAssets:
      return buildFrozenAssetsActivation(board);
    case CrazyEvent.SafeHaven:
      return buildSafeHavenActivation();
    // Phase 3 — Task 15.2 (Tier 1 Batch 2)
    case CrazyEvent.PromotionParty:
      return buildPromotionPartyActivation();
    case CrazyEvent.Demotion:
      return buildDemotionActivation(board);
    case CrazyEvent.ForcedMarch:
      return buildForcedMarchActivation(event, board);
    case CrazyEvent.RoyalDecree:
      return buildRoyalDecreeActivation(board);
    case CrazyEvent.Sentry:
      return buildSentryActivation(board);
    case CrazyEvent.RushHour:
      return buildRushHourActivation(board);
    // Phase 3 — Task 16.5 (Tier 2 Batch 1)
    case CrazyEvent.Conscription:
      return buildConscriptionActivation(board);
    case CrazyEvent.GhostWalk:
      return buildGhostWalkActivation(board);
    case CrazyEvent.Landmine:
      return buildLandmineActivation();
    case CrazyEvent.Leapfrog:
      return buildLeapfrogActivation(board);
    case CrazyEvent.DoubleTime:
      return buildDoubleTimeActivation(board);
    case CrazyEvent.ChainReaction:
      return buildChainReactionActivation(board);
    // Phase 3 — Task 16.5 (Tier 2 Batch 2)
    case CrazyEvent.Reinforcements:
      return boardAfter ? buildReinforcementsActivation(board, boardAfter) : [];
    case CrazyEvent.Wormhole:
      return buildWormholeActivation(event);
    case CrazyEvent.TimeBomb:
      return buildTimeBombActivation(event);
    case CrazyEvent.Ricochet:
      return buildRicochetActivation(board);
    case CrazyEvent.CrownThief:
      return buildCrownThiefActivation(board);
    case CrazyEvent.Stampede:
      return boardAfter ? buildStampedeActivation(board, boardAfter) : [];
    case CrazyEvent.TollRoad:
      return buildTollRoadActivation(board);
    case CrazyEvent.SwapMeet:
      return boardAfter ? buildSwapMeetActivation(board, boardAfter) : [];
    // Phase 3 — Task 16.5 (Tier 2 Batch 3)
    case CrazyEvent.Backfire:
      return buildBackfireActivation(board);
    case CrazyEvent.Sacrifice:
      return buildSacrificeActivation(board);
    // Phase 3 — Task 16.5 (Tier 3)
    case CrazyEvent.FlippedScript:
      return boardAfter ? buildFlippedScriptActivation(board, boardAfter) : [];
    case CrazyEvent.MarchingOrders:
      return buildMarchingOrdersActivation(board);
    case CrazyEvent.Haunted:
      return buildHauntedActivation(board);
    case CrazyEvent.ShrinkingBoard:
      return buildShrinkingBoardActivation();
    default:
      return [];
  }
}

function buildExpirationForEvent(
  event: ActiveEvent,
  board: BoardState,
): AnimationStep[] {
  switch (event.type) {
    case CrazyEvent.KingForADay:
      return buildKingForADayExpiration(event, board);
    case CrazyEvent.OppositeDay:
      return buildOppositeDayExpiration(board);
    case CrazyEvent.UpInTheAir:
      return buildUpInTheAirExpiration(board);
    // Phase 3 — Tier 1 expirations (Demotion is instant, no expiry)
    case CrazyEvent.StepBack:
      return buildStepBackExpiration(board);
    case CrazyEvent.DealersChoice:
      return buildDealersChoiceExpiration(board);
    case CrazyEvent.Bodyguard:
      return buildBodyguardExpiration(board);
    case CrazyEvent.Quicksand:
      return buildQuicksandExpiration(board);
    case CrazyEvent.FrozenAssets:
      return buildFrozenAssetsExpiration(board);
    case CrazyEvent.SafeHaven:
      return buildSafeHavenExpiration();
    case CrazyEvent.PromotionParty:
      return buildPromotionPartyExpiration();
    case CrazyEvent.ForcedMarch:
      return buildForcedMarchExpiration(board);
    case CrazyEvent.RoyalDecree:
      return buildRoyalDecreeExpiration(board);
    case CrazyEvent.Sentry:
      return buildSentryExpiration(board);
    case CrazyEvent.RushHour:
      return buildRushHourExpiration(board);
    // Phase 3 — Task 16.5 (Tier 2 expirations)
    case CrazyEvent.Conscription:
    case CrazyEvent.GhostWalk:
    case CrazyEvent.Leapfrog:
    case CrazyEvent.DoubleTime:
    case CrazyEvent.Ricochet:
    case CrazyEvent.CrownThief:
    case CrazyEvent.Sacrifice:
      return buildGenericAccentExpiry(board);
    case CrazyEvent.Landmine:
    case CrazyEvent.ChainReaction:
    case CrazyEvent.TollRoad:
    case CrazyEvent.Backfire:
      return buildGenericDangerExpiry(board);
    case CrazyEvent.Wormhole: {
      const meta = event.metadata as { wormholes?: ReadonlyArray<{ a: number; b: number }> } | undefined;
      const squares = (meta?.wormholes ?? []).flatMap(p => [square(p.a), square(p.b)]);
      return squares.length > 0
        ? [{ type: 'flash', squares, color: 'rgba(255, 165, 0, 0.6)', durationMs: EVENT_ANIM_DURATION.FLASH_PULSE, pulses: 1 }]
        : [];
    }
    // Permanent/condition-based events (no standard expiry): FlippedScript, MarchingOrders, Haunted, ShrinkingBoard
    // Instant events (no expiry): Reinforcements, Stampede, SwapMeet
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEventAnimations(_options: { flipped: boolean; }) {
  void _options;
  const buildActivationSequence = useCallback(
    (
      events: readonly ActiveEvent[],
      board: BoardState,
      boardAfter?: BoardState,
    ): AnimationStep[] => {
      const steps: AnimationStep[] = [];
      for (const event of events) {
        steps.push(...buildActivationForEvent(event, board, boardAfter));
      }
      return steps;
    },
    [],
  );

  const buildExpirationSequence = useCallback(
    (events: readonly ActiveEvent[], board: BoardState): AnimationStep[] => {
      const steps: AnimationStep[] = [];
      for (const event of events) {
        steps.push(...buildExpirationForEvent(event, board));
      }
      return steps;
    },
    [],
  );

  const buildMidMoveEffects = useCallback(
    (
      move: Move,
      expiredEvents: readonly ActiveEvent[],
      boardBefore: BoardState,
      boardAfter: BoardState,
    ): AnimationStep[] => {
      const steps: AnimationStep[] = [];
      for (const event of expiredEvents) {
        if (event.type === CrazyEvent.LiveGrenade && move.captured.length > 0) {
          steps.push(...buildLiveGrenadeDetonation(move, boardBefore, boardAfter));
        }
        if (event.type === CrazyEvent.HotPotato) {
          steps.push(...buildHotPotatoEffect(move, event));
        }
        // Tier 2/3 mid-move effects
        if (event.type === CrazyEvent.Conscription && move.captured.length > 0) {
          steps.push(...buildConscriptionEffect(move, boardBefore, boardAfter));
        }
        if (event.type === CrazyEvent.ChainReaction && move.captured.length > 0) {
          steps.push(...buildChainReactionEffect(move, boardBefore, boardAfter));
        }
        if (event.type === CrazyEvent.Landmine) {
          steps.push(...buildLandmineEffect(move, boardBefore, boardAfter));
        }
        if (event.type === CrazyEvent.CrownThief && move.captured.length > 0) {
          steps.push(...buildCrownThiefEffect(move, boardBefore, boardAfter));
        }
        if (event.type === CrazyEvent.TollRoad && move.captured.length > 0) {
          steps.push(...buildTollRoadEffect(move, boardBefore, boardAfter));
        }
        if (event.type === CrazyEvent.Sacrifice && move.captured.length > 0) {
          steps.push(...buildSacrificeEffect(boardBefore, boardAfter));
        }
      }
      return steps;
    },
    [],
  );

  return {
    buildActivationSequence,
    buildExpirationSequence,
    buildMidMoveEffects,
  };
}
