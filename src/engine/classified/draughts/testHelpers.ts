/**
 * Test-only helpers for Tier 1 engine unit tests.
 *
 * Builds a `ClassifiedGameState` from a small declarative placement record so
 * per-test fixtures stay readable. Not exported outside the draughts folder;
 * tests import relative.
 */

import type { NodeId } from '../../boardGeometry';
import { asNodeId } from '../../boardGeometry';
import type { ClassifiedGameState, ClassifiedPiece } from '../state';
import type { DraughtsConfig } from './DraughtsConfig';
import { boardSizeOf } from './DraughtsConfig';

export interface Placement {
  readonly row: number;
  readonly col: number;
  readonly owner: 'white' | 'black';
  readonly kind: 'man' | 'king';
}

export function makeState(
  config: DraughtsConfig,
  placements: readonly Placement[],
  turn: 'white' | 'black' = 'white',
): ClassifiedGameState {
  const size = boardSizeOf(config);
  const pieces = new Map<NodeId, ClassifiedPiece>();
  for (const p of placements) {
    const id = asNodeId(p.row * size + p.col);
    pieces.set(id, { owner: p.owner, kind: p.kind });
  }
  return {
    pieces,
    turn,
    plyCount: 0,
    moveHistory: [],
  };
}

export function labelOf(config: DraughtsConfig, row: number, col: number): string {
  const size = boardSizeOf(config);
  return config.boardGeometry.coordinateLabels.notationOf(asNodeId(row * size + col));
}
