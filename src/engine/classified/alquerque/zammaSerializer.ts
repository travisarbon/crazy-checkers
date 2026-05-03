/**
 * Zamma serializer (Phase 4 Task 29.3).
 *
 * Per playbook §7.2/§7.3 'standard' format: an 81-character row-major string
 * where each character is one of:
 *   - `_` empty
 *   - `m`/`M` white man / white Mullah
 *   - `b`/`B` black man / black Mullah
 *
 * Intersections are emitted in canonical NodeId order (0..80). The encoding
 * is fixed-length (always 81 chars). Together with a small envelope (turn,
 * halfMoveClock, plyCount, moveHistory, repetitionTable) this round-trips
 * losslessly.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type { GameStateSerializer } from '../../../persistence/serializers/types';
import type { ClassifiedGameId } from '../ClassifiedRuleSet';
import type {
  AlquerqueConfig,
  AlquerqueDirection,
  AlquerqueGameState,
  AlquerqueMeta,
  AlquerqueMove,
  AlquerqueOwner,
  AlquerquePieceKind,
} from './types';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AlquerqueSerializerCorruptionError extends Error {
  readonly gameId: 'zamma';
  readonly reason: string;
  constructor(gameId: 'zamma', reason: string) {
    super(`[${gameId}] alquerque serializer corruption: ${reason}`);
    this.name = 'AlquerqueSerializerCorruptionError';
    this.gameId = gameId;
    this.reason = reason;
  }
}

// ---------------------------------------------------------------------------
// Intersection alphabet
// ---------------------------------------------------------------------------

const PIECE_TO_CHAR: Record<AlquerqueOwner, Record<AlquerquePieceKind, string>> = {
  white: { man: 'm', mullah: 'M' },
  black: { man: 'b', mullah: 'B' },
};

const CHAR_TO_PIECE: Record<string, ClassifiedPiece> = Object.freeze({
  m: Object.freeze({ owner: 'white', kind: 'man' }),
  M: Object.freeze({ owner: 'white', kind: 'mullah' }),
  b: Object.freeze({ owner: 'black', kind: 'man' }),
  B: Object.freeze({ owner: 'black', kind: 'mullah' }),
});

// ---------------------------------------------------------------------------
// Persisted shape
// ---------------------------------------------------------------------------

interface ZammaPersistedV1 {
  readonly schemaVersion: 1;
  readonly gameId: 'zamma';
  readonly serializationType: 'standard';
  readonly boardSize: 9;
  readonly turn: AlquerqueOwner;
  readonly halfMoveClock: number;
  readonly plyCount: number;
  /** 81 chars, row-major (NodeId 0..80). */
  readonly intersections: string;
  readonly moveHistory: readonly AlquerqueMoveJSON[];
  readonly repetitionTable: readonly (readonly [string, number])[];
}

interface AlquerqueMoveJSON {
  readonly kind: 'step' | 'capture';
  readonly from: string;
  readonly to: string;
  readonly piece: AlquerquePieceKind;
  readonly capture: readonly string[];
  readonly promotion?: 'mullah';
  readonly meta?: {
    readonly owner?: AlquerqueOwner;
    readonly path?: readonly number[];
    readonly directions?: readonly AlquerqueDirection[];
  };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function createZammaSerializer(
  config: AlquerqueConfig,
): GameStateSerializer<AlquerqueGameState> & { readonly gameId: ClassifiedGameId } {
  const gameIdBranded = config.gameId as unknown as ClassifiedGameId;
  return {
    gameId: gameIdBranded,
    version: 1,
    toJSON(state) {
      return encode(state, config);
    },
    fromJSON(json) {
      return decode(json, config);
    },
  };
}

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

function encode(state: AlquerqueGameState, config: AlquerqueConfig): ZammaPersistedV1 {
  const total = config.boardSize * config.boardSize;
  const cells = new Array<string>(total);
  for (let i = 0; i < total; i += 1) {
    const node = i as unknown as NodeId;
    const piece = state.pieces.get(node);
    if (!piece) {
      cells[i] = '_';
      continue;
    }
    const owner = piece.owner;
    const kind = piece.kind;
    if (
      (owner !== 'white' && owner !== 'black') ||
      (kind !== 'man' && kind !== 'mullah')
    ) {
      throw new AlquerqueSerializerCorruptionError(
        config.gameId,
        `unknown piece at NodeId ${String(i)}: owner=${owner} kind=${kind}`,
      );
    }
    cells[i] = PIECE_TO_CHAR[owner][kind];
  }

  return {
    schemaVersion: 1,
    gameId: config.gameId,
    serializationType: 'standard',
    boardSize: config.boardSize,
    turn: state.turn,
    halfMoveClock: state.meta.halfMoveClock,
    plyCount: state.plyCount,
    intersections: cells.join(''),
    moveHistory: state.moveHistory.map((m) => encodeMove(m as AlquerqueMove)),
    repetitionTable: state.meta.repetitionTable.map(
      ([h, c]): readonly [string, number] => [h, c],
    ),
  };
}

function encodeMove(move: AlquerqueMove): AlquerqueMoveJSON {
  const out: {
    kind: 'step' | 'capture';
    from: string;
    to: string;
    piece: AlquerquePieceKind;
    capture: readonly string[];
    promotion?: 'mullah';
    meta?: {
      owner?: AlquerqueOwner;
      path?: readonly number[];
      directions?: readonly AlquerqueDirection[];
    };
  } = {
    kind: move.kind,
    from: move.from,
    to: move.to,
    piece: move.piece,
    capture: [...move.capture],
  };
  if (move.promotion) out.promotion = move.promotion;
  if (move.meta) {
    const meta: {
      owner?: AlquerqueOwner;
      path?: readonly number[];
      directions?: readonly AlquerqueDirection[];
    } = {};
    if (move.meta.owner) meta.owner = move.meta.owner;
    if (move.meta.path) meta.path = [...move.meta.path];
    if (move.meta.directions) meta.directions = [...move.meta.directions];
    out.meta = meta;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

function decode(json: unknown, config: AlquerqueConfig): AlquerqueGameState {
  if (typeof json !== 'object' || json === null) {
    throw new AlquerqueSerializerCorruptionError(config.gameId, 'payload is not an object');
  }
  const obj = json as Record<string, unknown>;
  if (obj.serializationType !== 'standard') {
    throw new AlquerqueSerializerCorruptionError(
      config.gameId,
      `expected serializationType "standard", got ${String(obj.serializationType)}`,
    );
  }
  if (obj.schemaVersion !== 1) {
    throw new AlquerqueSerializerCorruptionError(
      config.gameId,
      `unsupported schemaVersion ${String(obj.schemaVersion)}`,
    );
  }
  if (obj.gameId !== config.gameId) {
    throw new AlquerqueSerializerCorruptionError(
      config.gameId,
      `gameId mismatch: payload says "${String(obj.gameId)}"`,
    );
  }
  if (obj.boardSize !== config.boardSize) {
    throw new AlquerqueSerializerCorruptionError(
      config.gameId,
      `boardSize mismatch: payload says ${String(obj.boardSize)}`,
    );
  }
  const turn = obj.turn;
  if (turn !== 'white' && turn !== 'black') {
    throw new AlquerqueSerializerCorruptionError(config.gameId, `invalid turn: ${String(turn)}`);
  }
  const cells = obj.intersections;
  if (typeof cells !== 'string') {
    throw new AlquerqueSerializerCorruptionError(config.gameId, 'intersections missing or non-string');
  }
  const expectedLen = config.boardSize * config.boardSize;
  if (cells.length !== expectedLen) {
    throw new AlquerqueSerializerCorruptionError(
      config.gameId,
      `intersections string length ${String(cells.length)} ≠ expected ${String(expectedLen)}`,
    );
  }

  const pieces = new Map<NodeId, ClassifiedPiece>();
  for (let i = 0; i < expectedLen; i += 1) {
    const ch = cells[i];
    if (ch === undefined) {
      throw new AlquerqueSerializerCorruptionError(config.gameId, 'intersections string truncated');
    }
    if (ch === '_') continue;
    const piece = CHAR_TO_PIECE[ch];
    if (!piece) {
      throw new AlquerqueSerializerCorruptionError(
        config.gameId,
        `unknown intersection character "${ch}" at index ${String(i)}`,
      );
    }
    pieces.set(i as unknown as NodeId, piece);
  }

  const halfMoveClock = obj.halfMoveClock;
  if (typeof halfMoveClock !== 'number' || !Number.isInteger(halfMoveClock) || halfMoveClock < 0) {
    throw new AlquerqueSerializerCorruptionError(config.gameId, 'halfMoveClock invalid');
  }
  const plyCount = obj.plyCount;
  if (typeof plyCount !== 'number' || !Number.isInteger(plyCount) || plyCount < 0) {
    throw new AlquerqueSerializerCorruptionError(config.gameId, 'plyCount invalid');
  }

  const moveHistoryRaw = obj.moveHistory;
  if (!Array.isArray(moveHistoryRaw)) {
    throw new AlquerqueSerializerCorruptionError(config.gameId, 'moveHistory not an array');
  }
  const moveHistory = moveHistoryRaw.map((m, i) => decodeMove(m, config, i));

  const repetitionRaw = obj.repetitionTable;
  if (!Array.isArray(repetitionRaw)) {
    throw new AlquerqueSerializerCorruptionError(config.gameId, 'repetitionTable not an array');
  }
  const repetitionTable = repetitionRaw.map((entry, i): readonly [string, number] => {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new AlquerqueSerializerCorruptionError(
        config.gameId,
        `repetitionTable[${String(i)}] not a [hex, count] tuple`,
      );
    }
    const hex: unknown = entry[0];
    const count: unknown = entry[1];
    if (typeof hex !== 'string' || !/^[0-9a-f]{16}$/.test(hex)) {
      throw new AlquerqueSerializerCorruptionError(
        config.gameId,
        `repetitionTable[${String(i)}] hex malformed`,
      );
    }
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
      throw new AlquerqueSerializerCorruptionError(
        config.gameId,
        `repetitionTable[${String(i)}] count malformed`,
      );
    }
    return Object.freeze([hex, count]);
  });

  const meta: AlquerqueMeta = {
    turnTag: turn,
    halfMoveClock,
    repetitionTable: Object.freeze(repetitionTable),
  };

  return {
    pieces,
    turn,
    plyCount,
    moveHistory: Object.freeze(moveHistory),
    meta,
  };
}

function decodeMove(raw: unknown, config: AlquerqueConfig, index: number): AlquerqueMove {
  if (typeof raw !== 'object' || raw === null) {
    throw new AlquerqueSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}] not an object`,
    );
  }
  const m = raw as Record<string, unknown>;
  if (m.kind !== 'step' && m.kind !== 'capture') {
    throw new AlquerqueSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}].kind invalid: ${String(m.kind)}`,
    );
  }
  const from = m.from;
  const to = m.to;
  const piece = m.piece;
  if (typeof from !== 'string' || typeof to !== 'string') {
    throw new AlquerqueSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}] from/to not strings`,
    );
  }
  if (piece !== 'man' && piece !== 'mullah') {
    throw new AlquerqueSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}].piece invalid`,
    );
  }
  const captureRaw = m.capture;
  if (!Array.isArray(captureRaw)) {
    throw new AlquerqueSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}].capture not array`,
    );
  }
  const capture = captureRaw.map((c) => {
    if (typeof c !== 'string') {
      throw new AlquerqueSerializerCorruptionError(
        config.gameId,
        `moveHistory[${String(index)}].capture entry not string`,
      );
    }
    return c;
  });
  const baseMove: {
    kind: 'step' | 'capture';
    from: string;
    to: string;
    piece: AlquerquePieceKind;
    capture: readonly string[];
    promotion?: 'mullah';
    meta?: NonNullable<AlquerqueMove['meta']>;
  } = {
    kind: m.kind,
    from,
    to,
    piece,
    capture,
  };
  if (m.promotion === 'mullah') baseMove.promotion = 'mullah';
  if (m.meta && typeof m.meta === 'object') {
    const metaRaw = m.meta as Record<string, unknown>;
    const meta: {
      owner?: AlquerqueOwner;
      path?: readonly number[];
      directions?: readonly AlquerqueDirection[];
    } = {};
    if (metaRaw.owner === 'white' || metaRaw.owner === 'black') meta.owner = metaRaw.owner;
    if (Array.isArray(metaRaw.path)) {
      meta.path = metaRaw.path.map((n) => {
        if (typeof n !== 'number' || !Number.isInteger(n)) {
          throw new AlquerqueSerializerCorruptionError(
            config.gameId,
            `moveHistory[${String(index)}].meta.path entry not int`,
          );
        }
        return n;
      });
    }
    if (Array.isArray(metaRaw.directions)) {
      meta.directions = metaRaw.directions.map((d) => {
        if (typeof d !== 'string') {
          throw new AlquerqueSerializerCorruptionError(
            config.gameId,
            `moveHistory[${String(index)}].meta.directions entry not string`,
          );
        }
        return d as AlquerqueDirection;
      });
    }
    baseMove.meta = meta;
  }
  return baseMove;
}
