/**
 * Test helpers for Harzdame (Task 29.5).
 *
 * Build typed `HarzdameGameState` fixtures with concise notation:
 *   buildState({
 *     turn: 'white',
 *     pieces: { '1': 'm', '17': 'M', '32': 'S', '5': 'b' },
 *   })
 *
 * Single-letter piece spec: `m` (white-man), `M` (white-king regular),
 * `S` (white-senior-king), `b` (black-man), `B` (black-king regular),
 * `s` (black-senior-king). Square labels: PDN ('1'..'32') or algebraic.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type {
  HarzdameConfig,
  HarzdameGameState,
  HarzdameMeta,
  HarzdameMove,
  HarzdameOwner,
} from './types';
import { createHarzdameConfig } from './types';
import { hashPosition, hashToHex } from './harzdameZobrist';

const CHAR_TO_PIECE: Record<string, ClassifiedPiece> = Object.freeze({
  m: Object.freeze({ owner: 'white', kind: 'man' }),
  M: Object.freeze({ owner: 'white', kind: 'king' }),
  S: Object.freeze({ owner: 'white', kind: 'king', promoted: true }),
  b: Object.freeze({ owner: 'black', kind: 'man' }),
  B: Object.freeze({ owner: 'black', kind: 'king' }),
  s: Object.freeze({ owner: 'black', kind: 'king', promoted: true }),
});

export interface BuildStateOptions {
  readonly config?: HarzdameConfig;
  readonly turn?: HarzdameOwner;
  readonly pieces: Readonly<Record<string, string>>;
  readonly halfMoveClock?: number;
  readonly skipRepetitionSeed?: boolean;
}

export function buildState(opts: BuildStateOptions): HarzdameGameState {
  const config = opts.config ?? createHarzdameConfig();
  const turn = opts.turn ?? 'white';
  const pieces = new Map<NodeId, ClassifiedPiece>();
  for (const [label, spec] of Object.entries(opts.pieces)) {
    const node = config.boardGeometry.coordinateLabels.parseNotation(label);
    if (node === null) {
      throw new Error(`[testHelpers] buildState: cannot parse "${label}"`);
    }
    if (spec.length !== 1) {
      throw new Error(`[testHelpers] buildState: piece spec must be one char (got "${spec}")`);
    }
    const piece = CHAR_TO_PIECE[spec];
    if (!piece) {
      throw new Error(`[testHelpers] buildState: unknown piece spec "${spec}" at ${label}`);
    }
    pieces.set(node, piece);
  }

  const repetitionTable: readonly (readonly [string, number])[] = opts.skipRepetitionSeed
    ? []
    : [Object.freeze([hashToHex(hashPosition(pieces, turn, config)), 1])];
  const meta: HarzdameMeta = {
    turnTag: turn,
    halfMoveClock: opts.halfMoveClock ?? 0,
    repetitionTable: Object.freeze(repetitionTable),
    seniorKings: Object.freeze(
      [...pieces.entries()]
        .filter(([, p]) => p.kind === 'king' && p.promoted === true)
        .map(([n]) => n as unknown as number)
        .sort((a, b) => a - b),
    ),
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
  moves: readonly HarzdameMove[],
  predicate: { from: string; to: string; kind?: HarzdameMove['kind'] },
  config: HarzdameConfig,
): HarzdameMove {
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
  return matches[0] as HarzdameMove;
}

export function pieceSpecAt(
  state: HarzdameGameState,
  label: string,
  config: HarzdameConfig,
): string {
  const node = config.boardGeometry.coordinateLabels.parseNotation(label);
  if (node === null) return '<bad-label>';
  const piece = state.pieces.get(node);
  if (!piece) return '_';
  if (piece.owner === 'white' && piece.kind === 'man') return 'm';
  if (piece.owner === 'white' && piece.kind === 'king') {
    return piece.promoted === true ? 'S' : 'M';
  }
  if (piece.owner === 'black' && piece.kind === 'man') return 'b';
  if (piece.owner === 'black' && piece.kind === 'king') {
    return piece.promoted === true ? 's' : 'B';
  }
  return '?';
}
