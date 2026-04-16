/**
 * Tier 1 draughts starting-position generator (Task 28.1).
 *
 * Pure, deterministic: given a `DraughtsConfig`, emit a `ClassifiedGameState`
 * whose `pieces` map matches the authoritative reference images in the Tier 1
 * Playbook §4.1..§4.10. The emitted state always has `turn: 'white'`,
 * `plyCount: 0`, `moveHistory: []`.
 *
 * Piece vocabulary: `{ owner: 'white' | 'black', kind: 'man' }`. Kings appear
 * only after promotion (Task 28.2 authors that transition).
 */

import type { NodeId } from '../../boardGeometry';
import { asNodeId } from '../../boardGeometry';
import type { ClassifiedGameState, ClassifiedPiece } from '../state';
import type { StartOptions } from '../ClassifiedRuleSet';
import type { DraughtsConfig, StartingLayout } from './DraughtsConfig';
import { boardSizeOf } from './DraughtsConfig';

export class StartingPositionMismatchError extends Error {
  readonly gameId: string;
  readonly expected: number;
  readonly actual: number;
  constructor(gameId: string, expected: number, actual: number) {
    super(
      `[${gameId}] starting-position piece count mismatch: expected ${String(
        expected,
      )}, got ${String(actual)}`,
    );
    this.name = 'StartingPositionMismatchError';
    this.gameId = gameId;
    this.expected = expected;
    this.actual = actual;
  }
}

type Owner = 'white' | 'black';

const MAN: Record<Owner, ClassifiedPiece> = Object.freeze({
  white: Object.freeze({ owner: 'white', kind: 'man' }),
  black: Object.freeze({ owner: 'black', kind: 'man' }),
});

export function generateStartingPosition(
  config: DraughtsConfig,
  options?: StartOptions,
): ClassifiedGameState {
  void options; // Tier 1 does not branch on StartOptions; reserved for analysis tools.
  const size = boardSizeOf(config);
  const pieces = new Map<NodeId, ClassifiedPiece>();

  placeByLayout(pieces, config.startingLayout, size);

  const total = 2 * config.piecesPerSide;
  if (pieces.size !== total) {
    throw new StartingPositionMismatchError(config.gameId, total, pieces.size);
  }

  return Object.freeze({
    pieces,
    turn: 'white',
    plyCount: 0,
    moveHistory: Object.freeze([] as const),
  }) as ClassifiedGameState;
}

function placeByLayout(
  pieces: Map<NodeId, ClassifiedPiece>,
  layout: StartingLayout,
  size: 8 | 10 | 12,
): void {
  switch (layout) {
    case 'dark-squares-3-rows':
      placeDarkBand(pieces, size, 'black', 0, 2);
      placeDarkBand(pieces, size, 'white', 5, 7);
      return;
    case 'dark-squares-4-rows':
      placeDarkBand(pieces, size, 'black', 0, 3);
      placeDarkBand(pieces, size, 'white', 6, 9);
      return;
    case 'dark-squares-5-rows':
      placeDarkBand(pieces, size, 'black', 0, 4);
      placeDarkBand(pieces, size, 'white', 7, 11);
      return;
    case 'dark-squares-back-row-only':
      placeDarkBand(pieces, size, 'black', 0, 0);
      placeDarkBand(pieces, size, 'white', size - 1, size - 1);
      return;
    case 'full-board-rows-2-and-3':
      placeFullBand(pieces, size, 'black', 1, 2);
      placeFullBand(pieces, size, 'white', 5, 6);
      return;
  }
}

function placeDarkBand(
  pieces: Map<NodeId, ClassifiedPiece>,
  size: number,
  owner: Owner,
  rowStart: number,
  rowEnd: number,
): void {
  for (let r = rowStart; r <= rowEnd; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if ((r + c) % 2 !== 1) continue;
      pieces.set(asNodeId(r * size + c), MAN[owner]);
    }
  }
}

function placeFullBand(
  pieces: Map<NodeId, ClassifiedPiece>,
  size: number,
  owner: Owner,
  rowStart: number,
  rowEnd: number,
): void {
  for (let r = rowStart; r <= rowEnd; r += 1) {
    for (let c = 0; c < size; c += 1) {
      pieces.set(asNodeId(r * size + c), MAN[owner]);
    }
  }
}
