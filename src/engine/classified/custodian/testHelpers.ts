/**
 * Test helpers for the custodian engine (Task 29.4).
 *
 * Build typed `CustodianGameState` fixtures with concise notation:
 *   buildState({
 *     config: createMakYekConfig(),
 *     turn: 'white',
 *     pieces: { 'a8': 'm', 'd5': 'b', 'e4': 'K' },
 *   })
 *
 * Single-letter piece spec: `m` white-man, `b` black-man, `K` white-king,
 * `k` black-king. Square labels accept algebraic ('a1'..'i9') or 1-based
 * row-major ints if the geometry's `parseNotation` supports them.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type {
  CustodianConfig,
  CustodianGameState,
  CustodianMeta,
  CustodianMove,
  CustodianOwner,
} from './types';
import { hashPosition, hashToHex } from './custodianZobrist';

const CHAR_TO_PIECE: Record<string, ClassifiedPiece> = Object.freeze({
  m: Object.freeze({ owner: 'white', kind: 'man' }),
  K: Object.freeze({ owner: 'white', kind: 'king' }),
  b: Object.freeze({ owner: 'black', kind: 'man' }),
  k: Object.freeze({ owner: 'black', kind: 'king' }),
});

export interface BuildStateOptions {
  readonly config: CustodianConfig;
  readonly turn?: CustodianOwner;
  readonly pieces: Readonly<Record<string, string>>;
  readonly halfMoveClock?: number;
  readonly skipRepetitionSeed?: boolean;
}

export function buildState(opts: BuildStateOptions): CustodianGameState {
  const { config, turn = 'white' } = opts;
  const pieces = new Map<NodeId, ClassifiedPiece>();
  for (const [label, spec] of Object.entries(opts.pieces)) {
    const node = config.boardGeometry.coordinateLabels.parseNotation(label);
    if (node === null) {
      throw new Error(`[testHelpers] buildState: cannot parse "${label}"`);
    }
    if (spec.length !== 1) {
      throw new Error(
        `[testHelpers] buildState: piece spec must be one char (got "${spec}")`,
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
  const meta: CustodianMeta = {
    turnTag: turn,
    halfMoveClock: opts.halfMoveClock ?? 0,
    repetitionTable: Object.freeze(repetitionTable),
    winningLines: null,
  };

  return {
    pieces,
    turn,
    plyCount: 0,
    moveHistory: Object.freeze([] as const),
    meta,
  };
}

export function findMove(
  moves: readonly CustodianMove[],
  predicate: { from: string; to: string; kind?: CustodianMove['kind'] },
  config: CustodianConfig,
): CustodianMove {
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
  return matches[0] as CustodianMove;
}

export function pieceSpecAt(
  state: CustodianGameState,
  label: string,
  config: CustodianConfig,
): string {
  const node = config.boardGeometry.coordinateLabels.parseNotation(label);
  if (node === null) return '<bad-label>';
  const piece = state.pieces.get(node);
  if (!piece) return '_';
  if (piece.owner === 'white' && piece.kind === 'man') return 'm';
  if (piece.owner === 'white' && piece.kind === 'king') return 'K';
  if (piece.owner === 'black' && piece.kind === 'man') return 'b';
  if (piece.owner === 'black' && piece.kind === 'king') return 'k';
  return '?';
}
