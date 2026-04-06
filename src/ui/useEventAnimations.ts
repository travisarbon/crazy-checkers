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
