/**
 * Test helpers for the stacking-draughts engine (Task 29.1).
 *
 * Build typed `StackingGameState` fixtures with concise notation:
 *   buildState({
 *     turn: 'white',
 *     pieces: { 'b6': 'm', 'a5': 'M', 'c5': 'b', 'd4': 'mb', 'e3': 'BM' },
 *   })
 *
 * Tower spec strings use the same single-letter alphabet as the serializer
 * (`m | M | b | B`, bottom-first). A bare letter is a height-1 tower; `mb`
 * is a height-2 tower with white-man on the bottom and black-man as the
 * commander.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type {
  StackingDraughtsConfig,
  StackingGameState,
  StackingMeta,
  StackingMove,
  StackingOwner,
  StackingPiece,
  StackingPieceKind,
} from './types';
import { createBashniConfig, createLascaConfig } from './types';
import { hashPosition, hashToHex } from './stackingZobrist';
import { makeStack, toClassifiedPiece } from './StackState';

const CHAR_TO_LAYER: Record<string, StackingPiece> = {
  m: { owner: 'white', kind: 'man' },
  M: { owner: 'white', kind: 'king' },
  b: { owner: 'black', kind: 'man' },
  B: { owner: 'black', kind: 'king' },
};

export interface BuildStateOptions {
  readonly config: StackingDraughtsConfig;
  readonly turn?: StackingOwner;
  readonly pieces: Readonly<Record<string, string>>;
  /**
   * Optional explicit halfMoveClock and repetitionTable for tests that need
   * to control them. Defaults: clock 0, table contains only the starting
   * hash for the seeded position.
   */
  readonly halfMoveClock?: number;
  /** When true, omit the auto-seeded repetition entry (lets tests own the table). */
  readonly skipRepetitionSeed?: boolean;
}

export function buildState(opts: BuildStateOptions): StackingGameState {
  const { config, turn = 'white' } = opts;
  const pieces = new Map<NodeId, ClassifiedPiece>();
  for (const [label, spec] of Object.entries(opts.pieces)) {
    const node = config.boardGeometry.coordinateLabels.parseNotation(label);
    if (node === null) {
      throw new Error(`[testHelpers] buildState: cannot parse "${label}"`);
    }
    pieces.set(node, toClassifiedPiece(makeStack(parseTowerSpec(spec))));
  }

  const repetitionTable: readonly (readonly [string, number])[] = opts.skipRepetitionSeed
    ? []
    : [Object.freeze([hashToHex(hashPosition(pieces, turn, config)), 1])];
  const meta: StackingMeta = {
    stackingTurn: turn,
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

export function parseTowerSpec(spec: string): StackingPiece[] {
  if (spec.length === 0) {
    throw new Error('[testHelpers] parseTowerSpec: empty spec');
  }
  const layers: StackingPiece[] = [];
  for (const ch of spec) {
    const layer = CHAR_TO_LAYER[ch];
    if (!layer) {
      throw new Error(`[testHelpers] parseTowerSpec: unknown layer "${ch}" in "${spec}"`);
    }
    layers.push(layer);
  }
  return layers;
}

/** Convenience: shorthand for "give me a Lasca config" or Bashni. */
export function configFor(gameId: 'lasca' | 'bashni'): StackingDraughtsConfig {
  return gameId === 'lasca' ? createLascaConfig() : createBashniConfig();
}

/** Find a move by from/to/captures-list; throws if not found, for sharper test failures. */
export function findMove(
  moves: readonly StackingMove[],
  predicate: { from: string; to: string; captures?: readonly string[] },
): StackingMove {
  const matches = moves.filter((m) => {
    if (m.from !== predicate.from) return false;
    if (m.to !== predicate.to) return false;
    if (predicate.captures) {
      if (m.capture.length !== predicate.captures.length) return false;
      for (let i = 0; i < m.capture.length; i += 1) {
        if (m.capture[i] !== predicate.captures[i]) return false;
      }
    }
    return true;
  });
  if (matches.length === 0) {
    const summary = moves
      .map((m) => `${m.kind} ${m.from}→${m.to} cap=[${m.capture.join(',')}]`)
      .join('\n  ');
    throw new Error(
      `[testHelpers] findMove: no match for ${predicate.from}→${predicate.to} (captures=${
        predicate.captures ? predicate.captures.join(',') : '<any>'
      }). Available:\n  ${summary}`,
    );
  }
  return matches[0] as StackingMove;
}

/** Pretty-print a tower for diagnostic output. */
export function towerSpecAt(
  state: StackingGameState,
  label: string,
  config: StackingDraughtsConfig,
): string {
  const node = config.boardGeometry.coordinateLabels.parseNotation(label);
  if (node === null) return '<bad-label>';
  const piece = state.pieces.get(node);
  if (!piece) return '_';
  const stack = piece.stack ?? [];
  let body = '';
  for (const layer of stack) {
    body += LAYER_TO_CHAR[layer.owner as StackingOwner][layer.kind as StackingPieceKind];
  }
  return `T[${body}]`;
}

const LAYER_TO_CHAR: Record<StackingOwner, Record<StackingPieceKind, string>> = {
  white: { man: 'm', king: 'M' },
  black: { man: 'b', king: 'B' },
};
