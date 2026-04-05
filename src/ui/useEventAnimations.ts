// src/ui/useEventAnimations.ts
//
// Hook that provides functions to build animation step sequences for event
// triggers and expirations. Encapsulates the mapping from CrazyEvent type
// to animation choreography.

import { useCallback } from 'react';
import type { ActiveEvent, BoardState, Move, Square } from '../engine/types';
import { CrazyEvent, PieceColor, PieceType, square } from '../engine/types';
import { getBoardSquare, squareToGrid, gridToSquare } from '../engine/board';
import { EVENT_DISPLAY_NAMES } from '../engine/events';
import type { AnimationStep } from './useAnimationQueue';
import { EVENT_ANIM_DURATION, ANIM_DURATION, ANIM_EASING } from './useAnimationQueue';

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
      type: 'overlay',
      text: 'King for a Day!',
      icon: 'crown',
      durationMs: EVENT_ANIM_DURATION.OVERLAY,
    },
    {
      type: 'flash',
      squares: pawnSquares,
      color: 'var(--ui-accent)',
      durationMs: EVENT_ANIM_DURATION.FLASH,
      pulses: 3,
    },
  ];
}

function buildLiveGrenadeActivation(): AnimationStep[] {
  return [
    {
      type: 'overlay',
      text: 'Live Grenade!',
      icon: 'bomb',
      durationMs: EVENT_ANIM_DURATION.OVERLAY,
    },
  ];
}

function buildHotPotatoActivation(): AnimationStep[] {
  return [
    {
      type: 'overlay',
      text: 'Hot Potato!',
      icon: 'swap',
      durationMs: EVENT_ANIM_DURATION.OVERLAY,
    },
    {
      type: 'pause',
      durationMs: 200,
    },
  ];
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
      type: 'overlay',
      text: 'Checks Mix!',
      icon: 'shuffle',
      durationMs: EVENT_ANIM_DURATION.OVERLAY,
    },
    {
      type: 'shuffle',
      fromPositions,
      toPositions,
      durationMs: EVENT_ANIM_DURATION.SHUFFLE,
    },
  ];
}

function buildOppositeDayActivation(board: BoardState): AnimationStep[] {
  const occupiedSquares = getAllOccupiedSquares(board);

  return [
    {
      type: 'overlay',
      text: 'Opposite Day!',
      icon: 'invert',
      durationMs: EVENT_ANIM_DURATION.OVERLAY,
    },
    {
      type: 'flash',
      squares: occupiedSquares,
      color: 'var(--ui-danger)',
      durationMs: EVENT_ANIM_DURATION.FLASH,
      pulses: 2,
    },
  ];
}

function buildUpInTheAirActivation(board: BoardState): AnimationStep[] {
  const allPieceSquares = getAllOccupiedSquares(board);

  return [
    {
      type: 'overlay',
      text: 'Up in the Air!',
      icon: 'fly',
      durationMs: EVENT_ANIM_DURATION.OVERLAY,
    },
    {
      type: 'flash',
      squares: allPieceSquares,
      color: 'var(--ui-accent)',
      durationMs: EVENT_ANIM_DURATION.FLASH,
      pulses: 2,
    },
  ];
}

function buildNoTouchingActivation(board: BoardState): AnimationStep[] {
  const kingSquares = getAllKingSquares(board);

  return [
    {
      type: 'overlay',
      text: 'No Touching!',
      icon: 'shield',
      durationMs: EVENT_ANIM_DURATION.OVERLAY,
    },
    {
      type: 'flash',
      squares: kingSquares,
      color: 'var(--ui-accent)',
      durationMs: EVENT_ANIM_DURATION.FLASH,
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
      durationMs: 400,
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
      durationMs: 300,
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
      durationMs: 300,
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
    default:
      // Future events (8–40): generic overlay-only animation
      return [
        {
          type: 'overlay',
          text: EVENT_DISPLAY_NAMES[event.type],
          durationMs: EVENT_ANIM_DURATION.OVERLAY,
        },
      ];
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
