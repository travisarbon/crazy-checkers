/**
 * Custodian starting-position generator (Phase 4 Task 29.4).
 *
 * Reads `config.startingPosition.menRanks` (per-side rank indices, 0 = home
 * row), optional `kings` (Rek), and optional `menGapsForKing` (Rek) to
 * produce the canonical starting state for any of the four custodian
 * games. Convention: white starts at rows `0..` (top of board, NodeId
 * 0..size-1 = rank N..); black starts at rows `(size-1)..` (bottom).
 *
 * Mak-yek + Rek: rank 0 = row 0 (white) and row 7 (black); rank 2 = row 2
 * (white) and row 5 (black). Hasami Shogi: rank 0 = row 0 / row 8.
 * Dai Hasami: ranks 0, 1 = rows 0, 1 (white) and rows 7, 8 (black).
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import { asNodeId } from '../../boardGeometry';
import type {
  CustodianConfig,
  CustodianGameState,
  CustodianMeta,
  CustodianOwner,
} from './types';
import { hashPosition, hashToHex } from './custodianZobrist';

export class CustodianStartingPositionMismatchError extends Error {
  readonly gameId: string;
  readonly expected: number;
  readonly actual: number;
  constructor(gameId: string, expected: number, actual: number) {
    super(
      `[${gameId}] starting-position piece count mismatch: expected ${String(expected)}, got ${String(actual)}`,
    );
    this.name = 'CustodianStartingPositionMismatchError';
    this.gameId = gameId;
    this.expected = expected;
    this.actual = actual;
  }
}

export function buildStartingState(config: CustodianConfig): CustodianGameState {
  const { boardSize, gameId } = config;
  const pieces = new Map<NodeId, ClassifiedPiece>();
  const sp = config.startingPosition;

  // Compute "home rank" mapping: white's rank 0 = row 0; black's rank 0 = row size-1.
  // Filling "rank k" for white = row k; for black = row size-1-k.
  const placedGaps = new Set<number>();
  if (sp.menGapsForKing) {
    for (const gap of sp.menGapsForKing) {
      placedGaps.add(gap.rank * boardSize + gap.file);
    }
  }

  for (const rank of sp.menRanks) {
    placeManRank(pieces, boardSize, 'white', rank, placedGaps);
    placeManRank(pieces, boardSize, 'black', boardSize - 1 - rank, placedGaps);
  }

  if (sp.kings) {
    for (const king of sp.kings) {
      const node = asNodeId(king.rank * boardSize + king.file);
      pieces.set(node, kingFor(king.side));
    }
  }

  const totalExpected = sp.piecesPerSide * 2;
  if (pieces.size !== totalExpected) {
    throw new CustodianStartingPositionMismatchError(gameId, totalExpected, pieces.size);
  }

  const initialHash = hashPosition(pieces, 'white', config);
  const seededEntry: readonly [string, number] = Object.freeze([
    hashToHex(initialHash),
    1,
  ]);
  const meta: CustodianMeta = {
    turnTag: 'white',
    halfMoveClock: 0,
    repetitionTable: Object.freeze([seededEntry]),
    winningLines: null,
  };

  return {
    pieces,
    turn: 'white',
    plyCount: 0,
    moveHistory: Object.freeze([] as const),
    meta,
  };
}

function placeManRank(
  pieces: Map<NodeId, ClassifiedPiece>,
  size: number,
  owner: CustodianOwner,
  row: number,
  gaps: ReadonlySet<number>,
): void {
  for (let c = 0; c < size; c += 1) {
    if (gaps.has(row * size + c)) continue;
    pieces.set(asNodeId(row * size + c), manFor(owner));
  }
}

function manFor(owner: CustodianOwner): ClassifiedPiece {
  return Object.freeze({ owner, kind: 'man' });
}

function kingFor(owner: CustodianOwner): ClassifiedPiece {
  return Object.freeze({ owner, kind: 'king' });
}
