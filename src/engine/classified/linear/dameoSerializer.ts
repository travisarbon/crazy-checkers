/**
 * Dameo serializer (Phase 4 Task 29.2).
 *
 * Per playbook §7.2/§7.3 'standard' format: a 64-character row-major string
 * where each character is one of:
 *   - `_` empty
 *   - `m`/`M` white man / white king
 *   - `b`/`B` black man / black king
 *
 * Squares are emitted in canonical NodeId order (0..63). The encoding is
 * fixed-length (always 64 chars). Together with a small envelope (turn,
 * halfMoveClock, plyCount, moveHistory, repetitionTable) this round-trips
 * losslessly.
 *
 * Round-trip guarantee: `deserialize(serialize(state))` is structurally equal
 * to `state` (deep equality on every field, including `meta.repetitionTable`).
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type { GameStateSerializer } from '../../../persistence/serializers/types';
import type { ClassifiedGameId } from '../ClassifiedRuleSet';
import type {
  LinearDirection,
  LinearGameState,
  LinearMeta,
  LinearMove,
  LinearMovementConfig,
  LinearOwner,
  LinearPieceKind,
} from './types';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class LinearSerializerCorruptionError extends Error {
  readonly gameId: 'dameo';
  readonly reason: string;
  constructor(gameId: 'dameo', reason: string) {
    super(`[${gameId}] linear serializer corruption: ${reason}`);
    this.name = 'LinearSerializerCorruptionError';
    this.gameId = gameId;
    this.reason = reason;
  }
}

// ---------------------------------------------------------------------------
// Square alphabet
// ---------------------------------------------------------------------------

const PIECE_TO_CHAR: Record<LinearOwner, Record<LinearPieceKind, string>> = {
  white: { man: 'm', king: 'M' },
  black: { man: 'b', king: 'B' },
};

const CHAR_TO_PIECE: Record<string, ClassifiedPiece> = Object.freeze({
  m: Object.freeze({ owner: 'white', kind: 'man' }),
  M: Object.freeze({ owner: 'white', kind: 'king' }),
  b: Object.freeze({ owner: 'black', kind: 'man' }),
  B: Object.freeze({ owner: 'black', kind: 'king' }),
});

// ---------------------------------------------------------------------------
// Persisted shape
// ---------------------------------------------------------------------------

interface DameoPersistedV1 {
  readonly schemaVersion: 1;
  readonly gameId: 'dameo';
  readonly serializationType: 'standard';
  readonly boardSize: 8;
  readonly turn: LinearOwner;
  readonly halfMoveClock: number;
  readonly plyCount: number;
  /** 64 chars, row-major (NodeId 0..63). */
  readonly squares: string;
  readonly moveHistory: readonly LinearMoveJSON[];
  readonly repetitionTable: readonly (readonly [string, number])[];
}

interface LinearMoveJSON {
  readonly kind: 'step' | 'group-advance' | 'capture';
  readonly from: string;
  readonly to: string;
  readonly piece: LinearPieceKind;
  readonly direction: LinearDirection;
  readonly capture: readonly string[];
  readonly groupMembers?: readonly string[];
  readonly promotion?: 'king';
  readonly meta?: {
    readonly owner?: LinearOwner;
    readonly path?: readonly number[];
    readonly groupMemberNodes?: readonly number[];
  };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function createDameoSerializer(
  config: LinearMovementConfig,
): GameStateSerializer<LinearGameState> & { readonly gameId: ClassifiedGameId } {
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

function encode(state: LinearGameState, config: LinearMovementConfig): DameoPersistedV1 {
  const total = config.boardSize * config.boardSize;
  const squares = new Array<string>(total);
  for (let i = 0; i < total; i += 1) {
    const node = i as unknown as NodeId;
    const piece = state.pieces.get(node);
    if (!piece) {
      squares[i] = '_';
      continue;
    }
    const owner = piece.owner;
    const kind = piece.kind;
    if (
      (owner !== 'white' && owner !== 'black') ||
      (kind !== 'man' && kind !== 'king')
    ) {
      throw new LinearSerializerCorruptionError(
        config.gameId,
        `unknown piece at NodeId ${String(i)}: owner=${owner} kind=${kind}`,
      );
    }
    squares[i] = PIECE_TO_CHAR[owner][kind];
  }

  return {
    schemaVersion: 1,
    gameId: config.gameId,
    serializationType: 'standard',
    boardSize: config.boardSize,
    turn: state.turn,
    halfMoveClock: state.meta.halfMoveClock,
    plyCount: state.plyCount,
    squares: squares.join(''),
    moveHistory: state.moveHistory.map((m) => encodeMove(m as LinearMove)),
    repetitionTable: state.meta.repetitionTable.map(
      ([h, c]): readonly [string, number] => [h, c],
    ),
  };
}

function encodeMove(move: LinearMove): LinearMoveJSON {
  const out: {
    kind: 'step' | 'group-advance' | 'capture';
    from: string;
    to: string;
    piece: LinearPieceKind;
    direction: LinearDirection;
    capture: readonly string[];
    groupMembers?: readonly string[];
    promotion?: 'king';
    meta?: {
      owner?: LinearOwner;
      path?: readonly number[];
      groupMemberNodes?: readonly number[];
    };
  } = {
    kind: move.kind,
    from: move.from,
    to: move.to,
    piece: move.piece,
    direction: move.direction,
    capture: [...move.capture],
  };
  if (move.groupMembers) out.groupMembers = [...move.groupMembers];
  if (move.promotion) out.promotion = move.promotion;
  if (move.meta) {
    const meta: {
      owner?: LinearOwner;
      path?: readonly number[];
      groupMemberNodes?: readonly number[];
    } = {};
    if (move.meta.owner) meta.owner = move.meta.owner;
    if (move.meta.path) meta.path = [...move.meta.path];
    if (move.meta.groupMemberNodes) meta.groupMemberNodes = [...move.meta.groupMemberNodes];
    out.meta = meta;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

function decode(json: unknown, config: LinearMovementConfig): LinearGameState {
  if (typeof json !== 'object' || json === null) {
    throw new LinearSerializerCorruptionError(config.gameId, 'payload is not an object');
  }
  const obj = json as Record<string, unknown>;
  if (obj.serializationType !== 'standard') {
    throw new LinearSerializerCorruptionError(
      config.gameId,
      `expected serializationType "standard", got ${String(obj.serializationType)}`,
    );
  }
  if (obj.schemaVersion !== 1) {
    throw new LinearSerializerCorruptionError(
      config.gameId,
      `unsupported schemaVersion ${String(obj.schemaVersion)}`,
    );
  }
  if (obj.gameId !== config.gameId) {
    throw new LinearSerializerCorruptionError(
      config.gameId,
      `gameId mismatch: payload says "${String(obj.gameId)}"`,
    );
  }
  if (obj.boardSize !== config.boardSize) {
    throw new LinearSerializerCorruptionError(
      config.gameId,
      `boardSize mismatch: payload says ${String(obj.boardSize)}`,
    );
  }
  const turn = obj.turn;
  if (turn !== 'white' && turn !== 'black') {
    throw new LinearSerializerCorruptionError(config.gameId, `invalid turn: ${String(turn)}`);
  }
  const squares = obj.squares;
  if (typeof squares !== 'string') {
    throw new LinearSerializerCorruptionError(config.gameId, 'squares missing or non-string');
  }
  const expectedLen = config.boardSize * config.boardSize;
  if (squares.length !== expectedLen) {
    throw new LinearSerializerCorruptionError(
      config.gameId,
      `squares string length ${String(squares.length)} ≠ expected ${String(expectedLen)}`,
    );
  }

  const pieces = new Map<NodeId, ClassifiedPiece>();
  for (let i = 0; i < expectedLen; i += 1) {
    const ch = squares[i];
    if (ch === undefined) {
      throw new LinearSerializerCorruptionError(config.gameId, 'squares string truncated');
    }
    if (ch === '_') continue;
    const piece = CHAR_TO_PIECE[ch];
    if (!piece) {
      throw new LinearSerializerCorruptionError(
        config.gameId,
        `unknown square character "${ch}" at index ${String(i)}`,
      );
    }
    pieces.set(i as unknown as NodeId, piece);
  }

  const halfMoveClock = obj.halfMoveClock;
  if (typeof halfMoveClock !== 'number' || !Number.isInteger(halfMoveClock) || halfMoveClock < 0) {
    throw new LinearSerializerCorruptionError(config.gameId, 'halfMoveClock invalid');
  }
  const plyCount = obj.plyCount;
  if (typeof plyCount !== 'number' || !Number.isInteger(plyCount) || plyCount < 0) {
    throw new LinearSerializerCorruptionError(config.gameId, 'plyCount invalid');
  }

  const moveHistoryRaw = obj.moveHistory;
  if (!Array.isArray(moveHistoryRaw)) {
    throw new LinearSerializerCorruptionError(config.gameId, 'moveHistory not an array');
  }
  const moveHistory = moveHistoryRaw.map((m, i) => decodeMove(m, config, i));

  const repetitionRaw = obj.repetitionTable;
  if (!Array.isArray(repetitionRaw)) {
    throw new LinearSerializerCorruptionError(config.gameId, 'repetitionTable not an array');
  }
  const repetitionTable = repetitionRaw.map((entry, i): readonly [string, number] => {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new LinearSerializerCorruptionError(
        config.gameId,
        `repetitionTable[${String(i)}] not a [hex, count] tuple`,
      );
    }
    const hex: unknown = entry[0];
    const count: unknown = entry[1];
    if (typeof hex !== 'string' || !/^[0-9a-f]{16}$/.test(hex)) {
      throw new LinearSerializerCorruptionError(
        config.gameId,
        `repetitionTable[${String(i)}] hex malformed`,
      );
    }
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
      throw new LinearSerializerCorruptionError(
        config.gameId,
        `repetitionTable[${String(i)}] count malformed`,
      );
    }
    return Object.freeze([hex, count]);
  });

  const meta: LinearMeta = {
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

function decodeMove(raw: unknown, config: LinearMovementConfig, index: number): LinearMove {
  if (typeof raw !== 'object' || raw === null) {
    throw new LinearSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}] not an object`,
    );
  }
  const m = raw as Record<string, unknown>;
  if (m.kind !== 'step' && m.kind !== 'group-advance' && m.kind !== 'capture') {
    throw new LinearSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}].kind invalid: ${String(m.kind)}`,
    );
  }
  const from = m.from;
  const to = m.to;
  const piece = m.piece;
  const direction = m.direction;
  if (typeof from !== 'string' || typeof to !== 'string') {
    throw new LinearSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}] from/to not strings`,
    );
  }
  if (piece !== 'man' && piece !== 'king') {
    throw new LinearSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}].piece invalid`,
    );
  }
  if (typeof direction !== 'string') {
    throw new LinearSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}].direction not string`,
    );
  }
  const captureRaw = m.capture;
  if (!Array.isArray(captureRaw)) {
    throw new LinearSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}].capture not array`,
    );
  }
  const capture = captureRaw.map((c) => {
    if (typeof c !== 'string') {
      throw new LinearSerializerCorruptionError(
        config.gameId,
        `moveHistory[${String(index)}].capture entry not string`,
      );
    }
    return c;
  });
  const baseMove: {
    kind: 'step' | 'group-advance' | 'capture';
    from: string;
    to: string;
    piece: LinearPieceKind;
    direction: LinearDirection;
    capture: readonly string[];
    groupMembers?: readonly string[];
    promotion?: 'king';
    meta?: NonNullable<LinearMove['meta']>;
  } = {
    kind: m.kind,
    from,
    to,
    piece,
    direction: direction as LinearDirection,
    capture,
  };
  if (Array.isArray(m.groupMembers)) {
    baseMove.groupMembers = m.groupMembers.map((s) => {
      if (typeof s !== 'string') {
        throw new LinearSerializerCorruptionError(
          config.gameId,
          `moveHistory[${String(index)}].groupMembers entry not string`,
        );
      }
      return s;
    });
  }
  if (m.promotion === 'king') baseMove.promotion = 'king';
  if (m.meta && typeof m.meta === 'object') {
    const metaRaw = m.meta as Record<string, unknown>;
    const meta: {
      owner?: LinearOwner;
      path?: readonly number[];
      groupMemberNodes?: readonly number[];
    } = {};
    if (metaRaw.owner === 'white' || metaRaw.owner === 'black') meta.owner = metaRaw.owner;
    if (Array.isArray(metaRaw.path)) {
      meta.path = metaRaw.path.map((n) => {
        if (typeof n !== 'number' || !Number.isInteger(n)) {
          throw new LinearSerializerCorruptionError(
            config.gameId,
            `moveHistory[${String(index)}].meta.path entry not int`,
          );
        }
        return n;
      });
    }
    if (Array.isArray(metaRaw.groupMemberNodes)) {
      meta.groupMemberNodes = metaRaw.groupMemberNodes.map((n) => {
        if (typeof n !== 'number' || !Number.isInteger(n)) {
          throw new LinearSerializerCorruptionError(
            config.gameId,
            `moveHistory[${String(index)}].meta.groupMemberNodes entry not int`,
          );
        }
        return n;
      });
    }
    baseMove.meta = meta;
  }
  return baseMove;
}
