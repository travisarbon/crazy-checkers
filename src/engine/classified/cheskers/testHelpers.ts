/**
 * Test helpers for Cheskers (Task 29.6).
 *
 * Build typed `CheskersGameState` fixtures with concise notation:
 *   buildState({
 *     turn: 'black',
 *     pieces: { e1: 'K', g1: 'C', a1: 'B', d2: 'P', h8: 'b', d8: 'k' },
 *   })
 *
 * Single-letter piece spec: P = white-pawn, K = white-king, B = white-bishop,
 * C = white-camel; lowercase = black. Square labels: chess-algebraic ('a1')
 * or PDN ('1'..'32').
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type {
  CheskersConfig,
  CheskersGameState,
  CheskersMeta,
  CheskersMove,
  CheskersOwner,
} from './types';
import { createCheskersConfig } from './types';
import { hashPosition, hashToHex } from './cheskersZobrist';

const CHAR_TO_PIECE: Record<string, ClassifiedPiece> = Object.freeze({
  P: Object.freeze({ owner: 'white', kind: 'pawn' }),
  K: Object.freeze({ owner: 'white', kind: 'king' }),
  B: Object.freeze({ owner: 'white', kind: 'bishop' }),
  C: Object.freeze({ owner: 'white', kind: 'camel' }),
  p: Object.freeze({ owner: 'black', kind: 'pawn' }),
  k: Object.freeze({ owner: 'black', kind: 'king' }),
  b: Object.freeze({ owner: 'black', kind: 'bishop' }),
  c: Object.freeze({ owner: 'black', kind: 'camel' }),
});

export interface BuildStateOptions {
  readonly config?: CheskersConfig;
  readonly turn?: CheskersOwner;
  readonly pieces: Readonly<Record<string, string>>;
  readonly halfMoveClock?: number;
  readonly skipRepetitionSeed?: boolean;
}

export function buildState(opts: BuildStateOptions): CheskersGameState {
  const config = opts.config ?? createCheskersConfig();
  const turn = opts.turn ?? config.startingTurn;
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

  let whiteKings = 0;
  let blackKings = 0;
  for (const piece of pieces.values()) {
    if (piece.kind !== 'king') continue;
    if (piece.owner === 'white') whiteKings += 1;
    else if (piece.owner === 'black') blackKings += 1;
  }

  const repetitionTable: readonly (readonly [string, number])[] = opts.skipRepetitionSeed
    ? []
    : [Object.freeze<readonly [string, number]>([hashToHex(hashPosition(pieces, turn, config)), 1])];
  const meta: CheskersMeta = {
    turnTag: turn,
    halfMoveClock: opts.halfMoveClock ?? 0,
    repetitionTable: Object.freeze(repetitionTable),
    kingCount: Object.freeze({ white: whiteKings, black: blackKings }),
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
  moves: readonly CheskersMove[],
  predicate: { from: string; to: string; kind?: CheskersMove['kind'] },
  config: CheskersConfig,
): CheskersMove {
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
  return matches[0] as CheskersMove;
}

export function pieceSpecAt(
  state: CheskersGameState,
  label: string,
  config: CheskersConfig,
): string {
  const node = config.boardGeometry.coordinateLabels.parseNotation(label);
  if (node === null) return '<bad-label>';
  const piece = state.pieces.get(node);
  if (!piece) return '_';
  if (piece.owner === 'white') {
    if (piece.kind === 'pawn') return 'P';
    if (piece.kind === 'king') return 'K';
    if (piece.kind === 'bishop') return 'B';
    if (piece.kind === 'camel') return 'C';
  }
  if (piece.owner === 'black') {
    if (piece.kind === 'pawn') return 'p';
    if (piece.kind === 'king') return 'k';
    if (piece.kind === 'bishop') return 'b';
    if (piece.kind === 'camel') return 'c';
  }
  return '?';
}
