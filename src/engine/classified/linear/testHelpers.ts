/**
 * Test helpers for the linear-movement engine (Task 29.2).
 *
 * Build typed `LinearGameState` fixtures with concise notation:
 *   buildState({
 *     turn: 'white',
 *     pieces: { 'a1': 'm', 'b1': 'm', 'c1': 'm', 'd8': 'B' },
 *   })
 *
 * Single-letter piece spec: `m`/`M` for white-man/king, `b`/`B` for
 * black-man/king. Square labels use algebraic notation (a1..h8).
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type {
  LinearGameState,
  LinearMeta,
  LinearMove,
  LinearMovementConfig,
  LinearOwner,
} from './types';
import { createDameoConfig } from './types';
import { hashPosition, hashToHex } from './linearZobrist';

const CHAR_TO_PIECE: Record<string, ClassifiedPiece> = Object.freeze({
  m: Object.freeze({ owner: 'white', kind: 'man' }),
  M: Object.freeze({ owner: 'white', kind: 'king' }),
  b: Object.freeze({ owner: 'black', kind: 'man' }),
  B: Object.freeze({ owner: 'black', kind: 'king' }),
});

export interface BuildStateOptions {
  readonly config: LinearMovementConfig;
  readonly turn?: LinearOwner;
  readonly pieces: Readonly<Record<string, string>>;
  readonly halfMoveClock?: number;
  readonly skipRepetitionSeed?: boolean;
}

export function buildState(opts: BuildStateOptions): LinearGameState {
  const { config, turn = 'white' } = opts;
  const pieces = new Map<NodeId, ClassifiedPiece>();
  for (const [label, spec] of Object.entries(opts.pieces)) {
    const node = config.boardGeometry.coordinateLabels.parseNotation(label);
    if (node === null) {
      throw new Error(`[testHelpers] buildState: cannot parse "${label}"`);
    }
    if (spec.length !== 1) {
      throw new Error(
        `[testHelpers] buildState: piece spec must be one of m|M|b|B (got "${spec}")`,
      );
    }
    const piece = CHAR_TO_PIECE[spec];
    if (!piece) {
      throw new Error(
        `[testHelpers] buildState: unknown piece spec "${spec}" at ${label}`,
      );
    }
    pieces.set(node, piece);
  }

  const repetitionTable: readonly (readonly [string, number])[] = opts.skipRepetitionSeed
    ? []
    : [Object.freeze([hashToHex(hashPosition(pieces, turn, config)), 1])];
  const meta: LinearMeta = {
    turnTag: turn,
    halfMoveClock: opts.halfMoveClock ?? 0,
    repetitionTable: Object.freeze(repetitionTable),
  };

  return {
    pieces,
    turn,
    plyCount: 0,
    moveHistory: Object.freeze([] as const),
    meta,
  };
}

/** Convenience: shorthand for "give me the Dameo config". */
export function configFor(gameId: 'dameo'): LinearMovementConfig {
  void gameId;
  return createDameoConfig();
}

export function findMove(
  moves: readonly LinearMove[],
  predicate: { from: string; to: string; kind?: LinearMove['kind'] },
  config: LinearMovementConfig,
): LinearMove {
  const fromNode = config.boardGeometry.coordinateLabels.parseNotation(predicate.from);
  const toNode = config.boardGeometry.coordinateLabels.parseNotation(predicate.to);
  const matches = moves.filter((m) => {
    if (predicate.kind && m.kind !== predicate.kind) return false;
    const mf = config.boardGeometry.coordinateLabels.parseNotation(m.from);
    const mt = config.boardGeometry.coordinateLabels.parseNotation(m.to);
    return mf === fromNode && mt === toNode;
  });
  if (matches.length === 0) {
    const summary = moves
      .map((m) => `${m.kind} ${m.from}→${m.to} cap=[${m.capture.join(',')}]`)
      .join('\n  ');
    throw new Error(
      `[testHelpers] findMove: no match for ${predicate.from}→${predicate.to} kind=${
        predicate.kind ?? '<any>'
      }. Available:\n  ${summary}`,
    );
  }
  return matches[0] as LinearMove;
}

export function pieceSpecAt(
  state: LinearGameState,
  label: string,
  config: LinearMovementConfig,
): string {
  const node = config.boardGeometry.coordinateLabels.parseNotation(label);
  if (node === null) return '<bad-label>';
  const piece = state.pieces.get(node);
  if (!piece) return '_';
  if (piece.owner === 'white' && piece.kind === 'man') return 'm';
  if (piece.owner === 'white' && piece.kind === 'king') return 'M';
  if (piece.owner === 'black' && piece.kind === 'man') return 'b';
  if (piece.owner === 'black' && piece.kind === 'king') return 'B';
  return '?';
}
