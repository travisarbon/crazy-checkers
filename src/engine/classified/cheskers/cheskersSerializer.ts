/**
 * Cheskers serializer (Phase 4 Task 29.6).
 *
 * Per playbook §7.2 'chess' format with the four-piece extended alphabet:
 *
 *   - `_` empty
 *   - `P` / `p` white-pawn / black-pawn
 *   - `K` / `k` white-king / black-king
 *   - `B` / `b` white-bishop / black-bishop
 *   - `C` / `c` white-camel / black-camel
 *
 * Length: 32 chars (one per dark square in PDN order 1..32). Dispatch type
 * `'chess'` per playbook §7.3.
 *
 * Round-trip guarantee: `deserialize(serialize(state))` deep-equals `state`
 * (including `meta.repetitionTable`, `moveHistory`, `kingCount`, every
 * `pieces` entry's `kind`).
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type { GameStateSerializer } from '../../../persistence/serializers/types';
import type { ClassifiedGameId } from '../ClassifiedRuleSet';
import type { DraughtsDirection } from '../draughts/DraughtsConfig';
import type {
  CheskersConfig,
  CheskersGameState,
  CheskersMeta,
  CheskersMove,
  CheskersMoveKind,
  CheskersOwner,
  CheskersPieceKind,
} from './types';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CheskersSerializerCorruptionError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`[cheskers] serializer corruption: ${reason}`);
    this.name = 'CheskersSerializerCorruptionError';
    this.reason = reason;
  }
}

// ---------------------------------------------------------------------------
// Square alphabet
// ---------------------------------------------------------------------------

const PIECE_TO_CHAR = (
  owner: CheskersOwner,
  kind: CheskersPieceKind,
): string => {
  if (owner === 'white') {
    switch (kind) {
      case 'pawn':
        return 'P';
      case 'king':
        return 'K';
      case 'bishop':
        return 'B';
      case 'camel':
        return 'C';
    }
  }
  switch (kind) {
    case 'pawn':
      return 'p';
    case 'king':
      return 'k';
    case 'bishop':
      return 'b';
    case 'camel':
      return 'c';
  }
};

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

// ---------------------------------------------------------------------------
// Persisted shape
// ---------------------------------------------------------------------------

interface CheskersPersistedV1 {
  readonly schemaVersion: 1;
  readonly gameId: 'cheskers';
  readonly serializationType: 'chess';
  readonly boardSize: 8;
  readonly turn: CheskersOwner;
  readonly halfMoveClock: number;
  readonly plyCount: number;
  /** 32 chars, one per dark square in PDN order 1..32. */
  readonly squares: string;
  readonly moveHistory: readonly CheskersMoveJSON[];
  readonly repetitionTable: readonly (readonly [string, number])[];
  readonly kingCount?: { readonly white: number; readonly black: number };
}

interface CheskersMoveJSON {
  readonly kind: CheskersMoveKind;
  readonly from: string;
  readonly to: string;
  readonly piece: CheskersPieceKind;
  readonly capture: readonly string[];
  readonly promotion?: 'king' | 'bishop' | 'camel';
  readonly meta?: {
    readonly owner?: CheskersOwner;
    readonly fromNode?: number;
    readonly toNode?: number;
    readonly path?: readonly number[];
    readonly directions?: readonly DraughtsDirection[];
    readonly camelOffset?: readonly [number, number];
  };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function createCheskersSerializer(
  config: CheskersConfig,
): GameStateSerializer<CheskersGameState> & { readonly gameId: ClassifiedGameId } {
  const gameIdBranded = config.gameId as unknown as ClassifiedGameId;
  // Build PDN-1..32 → NodeId index map upfront.
  const pdnNodeOrder: NodeId[] = [];
  for (let pdn = 1; pdn <= 32; pdn += 1) {
    const node = config.boardGeometry.coordinateLabels.parseNotation(String(pdn));
    if (node === null) {
      throw new CheskersSerializerCorruptionError(
        `geometry does not support PDN ${String(pdn)}`,
      );
    }
    pdnNodeOrder.push(node);
  }
  return {
    gameId: gameIdBranded,
    version: 1,
    toJSON(state) {
      return encode(state, pdnNodeOrder);
    },
    fromJSON(json) {
      return decode(json, pdnNodeOrder);
    },
  };
}

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

function encode(
  state: CheskersGameState,
  pdnNodeOrder: readonly NodeId[],
): CheskersPersistedV1 {
  const cells = new Array<string>(32);
  for (let i = 0; i < 32; i += 1) {
    const node = pdnNodeOrder[i] as NodeId;
    const piece = state.pieces.get(node);
    if (!piece) {
      cells[i] = '_';
      continue;
    }
    const owner = piece.owner;
    const kind = piece.kind;
    if (
      (owner !== 'white' && owner !== 'black') ||
      (kind !== 'pawn' && kind !== 'king' && kind !== 'bishop' && kind !== 'camel')
    ) {
      throw new CheskersSerializerCorruptionError(
        `unknown piece at PDN ${String(i + 1)}: owner=${owner} kind=${kind}`,
      );
    }
    cells[i] = PIECE_TO_CHAR(owner, kind);
  }

  // Recompute kingCount for canonical output.
  let whiteKings = 0;
  let blackKings = 0;
  for (const piece of state.pieces.values()) {
    if (piece.kind !== 'king') continue;
    if (piece.owner === 'white') whiteKings += 1;
    else if (piece.owner === 'black') blackKings += 1;
  }

  return {
    schemaVersion: 1,
    gameId: 'cheskers',
    serializationType: 'chess',
    boardSize: 8,
    turn: state.turn,
    halfMoveClock: state.meta.halfMoveClock,
    plyCount: state.plyCount,
    squares: cells.join(''),
    moveHistory: state.moveHistory.map((m) => encodeMove(m as CheskersMove)),
    repetitionTable: state.meta.repetitionTable.map(
      ([h, c]): readonly [string, number] => [h, c],
    ),
    kingCount: { white: whiteKings, black: blackKings },
  };
}

function encodeMove(move: CheskersMove): CheskersMoveJSON {
  const out: {
    kind: CheskersMoveKind;
    from: string;
    to: string;
    piece: CheskersPieceKind;
    capture: readonly string[];
    promotion?: 'king' | 'bishop' | 'camel';
    meta?: {
      owner?: CheskersOwner;
      fromNode?: number;
      toNode?: number;
      path?: readonly number[];
      directions?: readonly DraughtsDirection[];
      camelOffset?: readonly [number, number];
    };
  } = {
    kind: move.kind,
    from: move.from,
    to: move.to,
    piece: move.piece,
    capture: [...move.capture],
  };
  if (move.promotion !== undefined) out.promotion = move.promotion;
  if (move.meta) {
    const meta: {
      owner?: CheskersOwner;
      fromNode?: number;
      toNode?: number;
      path?: readonly number[];
      directions?: readonly DraughtsDirection[];
      camelOffset?: readonly [number, number];
    } = {};
    if (move.meta.owner) meta.owner = move.meta.owner;
    if (move.meta.fromNode !== undefined) meta.fromNode = move.meta.fromNode;
    if (move.meta.toNode !== undefined) meta.toNode = move.meta.toNode;
    if (move.meta.path) meta.path = [...move.meta.path];
    if (move.meta.directions) meta.directions = [...move.meta.directions];
    if (move.meta.camelOffset) meta.camelOffset = [...move.meta.camelOffset] as [number, number];
    out.meta = meta;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

function decode(
  json: unknown,
  pdnNodeOrder: readonly NodeId[],
): CheskersGameState {
  if (typeof json !== 'object' || json === null) {
    throw new CheskersSerializerCorruptionError('payload is not an object');
  }
  const obj = json as Record<string, unknown>;
  if (obj.serializationType !== 'chess') {
    throw new CheskersSerializerCorruptionError(
      `expected serializationType "chess", got ${String(obj.serializationType)}`,
    );
  }
  if (obj.schemaVersion !== 1) {
    throw new CheskersSerializerCorruptionError(
      `unsupported schemaVersion ${String(obj.schemaVersion)}`,
    );
  }
  if (obj.gameId !== 'cheskers') {
    throw new CheskersSerializerCorruptionError(
      `gameId mismatch: payload says "${String(obj.gameId)}"`,
    );
  }
  if (obj.boardSize !== 8) {
    throw new CheskersSerializerCorruptionError(
      `boardSize mismatch: payload says ${String(obj.boardSize)}`,
    );
  }
  const turn = obj.turn;
  if (turn !== 'white' && turn !== 'black') {
    throw new CheskersSerializerCorruptionError(`invalid turn: ${String(turn)}`);
  }
  const cells = obj.squares;
  if (typeof cells !== 'string') {
    throw new CheskersSerializerCorruptionError('squares missing or non-string');
  }
  if (cells.length !== 32) {
    throw new CheskersSerializerCorruptionError(
      `squares string length ${String(cells.length)} ≠ expected 32`,
    );
  }

  const pieces = new Map<NodeId, ClassifiedPiece>();
  for (let i = 0; i < 32; i += 1) {
    const ch = cells[i];
    if (ch === undefined) {
      throw new CheskersSerializerCorruptionError('squares string truncated');
    }
    if (ch === '_') continue;
    const piece = CHAR_TO_PIECE[ch];
    if (!piece) {
      throw new CheskersSerializerCorruptionError(
        `unknown square character "${ch}" at index ${String(i)}`,
      );
    }
    const node = pdnNodeOrder[i] as NodeId;
    pieces.set(node, piece);
  }

  const halfMoveClock = obj.halfMoveClock;
  if (typeof halfMoveClock !== 'number' || !Number.isInteger(halfMoveClock) || halfMoveClock < 0) {
    throw new CheskersSerializerCorruptionError('halfMoveClock invalid');
  }
  const plyCount = obj.plyCount;
  if (typeof plyCount !== 'number' || !Number.isInteger(plyCount) || plyCount < 0) {
    throw new CheskersSerializerCorruptionError('plyCount invalid');
  }

  const moveHistoryRaw = obj.moveHistory;
  if (!Array.isArray(moveHistoryRaw)) {
    throw new CheskersSerializerCorruptionError('moveHistory not an array');
  }
  const moveHistory = moveHistoryRaw.map((m, i) => decodeMove(m, i));

  const repetitionRaw = obj.repetitionTable;
  if (!Array.isArray(repetitionRaw)) {
    throw new CheskersSerializerCorruptionError('repetitionTable not an array');
  }
  const repetitionTable = repetitionRaw.map((entry, i): readonly [string, number] => {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new CheskersSerializerCorruptionError(
        `repetitionTable[${String(i)}] not a [hex, count] tuple`,
      );
    }
    const hex: unknown = entry[0];
    const count: unknown = entry[1];
    if (typeof hex !== 'string' || !/^[0-9a-f]{16}$/.test(hex)) {
      throw new CheskersSerializerCorruptionError(
        `repetitionTable[${String(i)}] hex malformed`,
      );
    }
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
      throw new CheskersSerializerCorruptionError(
        `repetitionTable[${String(i)}] count malformed`,
      );
    }
    return Object.freeze([hex, count]);
  });

  // King-count is a re-derivable cache; recompute from pieces for canonicalization.
  let whiteKings = 0;
  let blackKings = 0;
  for (const piece of pieces.values()) {
    if (piece.kind !== 'king') continue;
    if (piece.owner === 'white') whiteKings += 1;
    else if (piece.owner === 'black') blackKings += 1;
  }

  const kingCountRaw = obj.kingCount;
  if (kingCountRaw !== null && kingCountRaw !== undefined) {
    if (typeof kingCountRaw !== 'object' || Array.isArray(kingCountRaw)) {
      throw new CheskersSerializerCorruptionError('kingCount not an object');
    }
    const kc = kingCountRaw as Record<string, unknown>;
    if (typeof kc.white !== 'number' || typeof kc.black !== 'number') {
      throw new CheskersSerializerCorruptionError('kingCount entries not numbers');
    }
    if (kc.white !== whiteKings || kc.black !== blackKings) {
      throw new CheskersSerializerCorruptionError(
        `kingCount mismatch: payload says white=${String(kc.white)} black=${String(kc.black)} but pieces parse white=${String(whiteKings)} black=${String(blackKings)}`,
      );
    }
  }

  const meta: CheskersMeta = {
    turnTag: turn,
    halfMoveClock,
    repetitionTable: Object.freeze(repetitionTable),
    kingCount: Object.freeze({ white: whiteKings, black: blackKings }),
  };

  return {
    pieces,
    turn,
    plyCount,
    moveHistory: Object.freeze(moveHistory),
    meta,
  };
}

function decodeMove(raw: unknown, index: number): CheskersMove {
  if (typeof raw !== 'object' || raw === null) {
    throw new CheskersSerializerCorruptionError(
      `moveHistory[${String(index)}] not an object`,
    );
  }
  const m = raw as Record<string, unknown>;
  const validKinds: readonly CheskersMoveKind[] = [
    'pawn-step',
    'king-step',
    'pawn-jump',
    'king-jump',
    'bishop-slide',
    'bishop-displace',
    'camel-leap',
    'camel-displace',
  ];
  if (typeof m.kind !== 'string' || !validKinds.includes(m.kind as CheskersMoveKind)) {
    throw new CheskersSerializerCorruptionError(
      `moveHistory[${String(index)}].kind invalid: ${String(m.kind)}`,
    );
  }
  const from = m.from;
  const to = m.to;
  const piece = m.piece;
  if (typeof from !== 'string' || typeof to !== 'string') {
    throw new CheskersSerializerCorruptionError(
      `moveHistory[${String(index)}] from/to not strings`,
    );
  }
  if (piece !== 'pawn' && piece !== 'king' && piece !== 'bishop' && piece !== 'camel') {
    throw new CheskersSerializerCorruptionError(
      `moveHistory[${String(index)}].piece invalid`,
    );
  }
  const captureRaw = m.capture;
  if (!Array.isArray(captureRaw)) {
    throw new CheskersSerializerCorruptionError(
      `moveHistory[${String(index)}].capture not array`,
    );
  }
  const capture = captureRaw.map((c) => {
    if (typeof c !== 'string') {
      throw new CheskersSerializerCorruptionError(
        `moveHistory[${String(index)}].capture entry not string`,
      );
    }
    return c;
  });
  const baseMove: {
    kind: CheskersMoveKind;
    from: string;
    to: string;
    piece: CheskersPieceKind;
    capture: readonly string[];
    promotion?: 'king' | 'bishop' | 'camel';
    meta?: NonNullable<CheskersMove['meta']>;
  } = {
    kind: m.kind as CheskersMoveKind,
    from,
    to,
    piece,
    capture,
  };
  if (m.promotion === 'king' || m.promotion === 'bishop' || m.promotion === 'camel') {
    baseMove.promotion = m.promotion;
  }
  if (m.meta && typeof m.meta === 'object') {
    const metaRaw = m.meta as Record<string, unknown>;
    const meta: {
      owner?: CheskersOwner;
      fromNode?: number;
      toNode?: number;
      path?: readonly number[];
      directions?: readonly DraughtsDirection[];
      camelOffset?: readonly [number, number];
    } = {};
    if (metaRaw.owner === 'white' || metaRaw.owner === 'black') meta.owner = metaRaw.owner;
    if (typeof metaRaw.fromNode === 'number' && Number.isInteger(metaRaw.fromNode)) {
      meta.fromNode = metaRaw.fromNode;
    }
    if (typeof metaRaw.toNode === 'number' && Number.isInteger(metaRaw.toNode)) {
      meta.toNode = metaRaw.toNode;
    }
    if (Array.isArray(metaRaw.path)) {
      meta.path = metaRaw.path.map((n) => {
        if (typeof n !== 'number' || !Number.isInteger(n)) {
          throw new CheskersSerializerCorruptionError(
            `moveHistory[${String(index)}].meta.path entry not int`,
          );
        }
        return n;
      });
    }
    if (Array.isArray(metaRaw.directions)) {
      meta.directions = metaRaw.directions.map((d) => {
        if (typeof d !== 'string') {
          throw new CheskersSerializerCorruptionError(
            `moveHistory[${String(index)}].meta.directions entry not string`,
          );
        }
        return d as DraughtsDirection;
      });
    }
    if (Array.isArray(metaRaw.camelOffset) && metaRaw.camelOffset.length === 2) {
      const offset = metaRaw.camelOffset as readonly unknown[];
      const a: unknown = offset[0];
      const b: unknown = offset[1];
      if (typeof a !== 'number' || typeof b !== 'number') {
        throw new CheskersSerializerCorruptionError(
          `moveHistory[${String(index)}].meta.camelOffset not [number, number]`,
        );
      }
      meta.camelOffset = [a, b];
    }
    baseMove.meta = meta;
  }
  return baseMove;
}
