/**
 * Starting-position generator for stacking-draughts games (Phase 4 Task 29.1).
 *
 * Lasca (7×7, parity 0): row 0 has 4 dark squares, row 1 has 3, row 2 has 4
 * — total 11 black men. White mirrors at rows 4–6.
 * Bashni (8×8, parity 1): rows 0–2 give black 12 men; white mirrors at 5–7.
 *
 * Both layouts produce single-piece towers (height 1) — towers grow only
 * during play, when captures attach prisoners. Every starting tower's
 * commander is a `man`; kings are exclusively a promotion product.
 */

import type { ClassifiedPiece } from '../state';
import type {
  StackingDraughtsConfig,
  StackingGameState,
  StackingMeta,
  StackingOwner,
} from './types';
import { asNodeId, type NodeId } from '../../boardGeometry';
import { singletonStack, toClassifiedPiece } from './StackState';
import { hashPosition } from './stackingZobrist';

export class StartingPositionMismatchError extends Error {
  readonly gameId: string;
  readonly expected: number;
  readonly actual: number;
  constructor(gameId: string, expected: number, actual: number) {
    super(
      `[${gameId}] starting-position piece count mismatch: expected ${String(expected)}, got ${String(actual)}`,
    );
    this.name = 'StartingPositionMismatchError';
    this.gameId = gameId;
    this.expected = expected;
    this.actual = actual;
  }
}

export function buildStartingState(config: StackingDraughtsConfig): StackingGameState {
  const { boardSize, darkParity, piecesPerSide, gameId } = config;
  const pieces = new Map<NodeId, ClassifiedPiece>();

  // Black fills rows [0, startingRows-1]; white fills rows [size-startingRows, size-1].
  placeBand(pieces, boardSize, darkParity, 'black', 0, config.startingRows - 1);
  placeBand(
    pieces,
    boardSize,
    darkParity,
    'white',
    boardSize - config.startingRows,
    boardSize - 1,
  );

  const total = piecesPerSide * 2;
  if (pieces.size !== total) {
    throw new StartingPositionMismatchError(gameId, total, pieces.size);
  }

  const meta: StackingMeta = {
    stackingTurn: 'white',
    halfMoveClock: 0,
    repetitionTable: [],
  };

  // Seed the repetition table with the starting position's hash.
  const initialHash = hashPosition(pieces, 'white', config);
  const seededEntry: readonly [string, number] = Object.freeze([
    initialHash.toString(16).padStart(16, '0'),
    1,
  ]);
  const seededMeta: StackingMeta = {
    ...meta,
    repetitionTable: Object.freeze([seededEntry]),
  };

  return {
    pieces,
    turn: 'white',
    plyCount: 0,
    moveHistory: Object.freeze([] as const),
    meta: seededMeta,
  };
}

function placeBand(
  pieces: Map<NodeId, ClassifiedPiece>,
  size: number,
  parity: 0 | 1,
  owner: StackingOwner,
  rowStart: number,
  rowEnd: number,
): void {
  for (let r = rowStart; r <= rowEnd; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if ((r + c) % 2 !== parity) continue;
      pieces.set(asNodeId(r * size + c), toClassifiedPiece(singletonStack(owner)));
    }
  }
}
