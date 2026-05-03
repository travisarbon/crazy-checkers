/**
 * Custodian-engine serializer (Phase 4 Task 29.4).
 *
 * Per playbook §7.3 'standard' format: a fixed-length row-major string
 * where each character is one of:
 *   - `_` empty
 *   - `m` / `b` white-man / black-man
 *   - `K` / `k` white-king / black-king (Rek only)
 *
 * Length: 64 chars for 8×8 (Mak-yek, Rek), 81 chars for 9×9 (Hasami Shogi,
 * Dai Hasami Shogi). Plus a small envelope (turn, halfMoveClock, plyCount,
 * moveHistory, repetitionTable, optional winningLines for Dai Hasami).
 *
 * Round-trip guarantee: `deserialize(serialize(state))` deep-equals `state`.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type { GameStateSerializer } from '../../../persistence/serializers/types';
import type { ClassifiedGameId } from '../ClassifiedRuleSet';
import type {
  CustodianConfig,
  CustodianGameId,
  CustodianGameState,
  CustodianMeta,
  CustodianMove,
  CustodianMoveKind,
  CustodianOwner,
  CustodianPieceKind,
} from './types';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CustodianSerializerCorruptionError extends Error {
  readonly gameId: CustodianGameId;
  readonly reason: string;
  constructor(gameId: CustodianGameId, reason: string) {
    super(`[${gameId}] custodian serializer corruption: ${reason}`);
    this.name = 'CustodianSerializerCorruptionError';
    this.gameId = gameId;
    this.reason = reason;
  }
}

// ---------------------------------------------------------------------------
// Square alphabet
// ---------------------------------------------------------------------------

const PIECE_TO_CHAR: Record<CustodianOwner, Record<CustodianPieceKind, string>> = {
  white: { man: 'm', king: 'K' },
  black: { man: 'b', king: 'k' },
};

const CHAR_TO_PIECE: Record<string, ClassifiedPiece> = Object.freeze({
  m: Object.freeze({ owner: 'white', kind: 'man' }),
  K: Object.freeze({ owner: 'white', kind: 'king' }),
  b: Object.freeze({ owner: 'black', kind: 'man' }),
  k: Object.freeze({ owner: 'black', kind: 'king' }),
});

// ---------------------------------------------------------------------------
// Persisted shape
// ---------------------------------------------------------------------------

interface CustodianPersistedV1 {
  readonly schemaVersion: 1;
  readonly gameId: CustodianGameId;
  readonly serializationType: 'standard';
  readonly boardSize: 8 | 9;
  readonly turn: CustodianOwner;
  readonly halfMoveClock: number;
  readonly plyCount: number;
  readonly squares: string;
  readonly moveHistory: readonly CustodianMoveJSON[];
  readonly repetitionTable: readonly (readonly [string, number])[];
  /** Dai Hasami only; null otherwise. */
  readonly winningLines: readonly (readonly number[])[] | null;
}

interface CustodianMoveJSON {
  readonly kind: CustodianMoveKind;
  readonly from: string;
  readonly to: string;
  readonly piece: CustodianPieceKind;
  readonly capture: readonly string[];
  readonly meta?: {
    readonly owner?: CustodianOwner;
    readonly fromNode?: number;
    readonly toNode?: number;
    readonly captureBreakdown?: {
      readonly custodian?: readonly number[];
      readonly intervention?: readonly number[];
      readonly corner?: readonly number[];
      readonly immobilization?: readonly number[];
      readonly line?: readonly number[];
    };
    readonly winningLine?: readonly number[];
  };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function createCustodianSerializer(
  config: CustodianConfig,
): GameStateSerializer<CustodianGameState> & { readonly gameId: ClassifiedGameId } {
  const allowKing = config.pieceTypes.includes('king');
  const gameIdBranded = config.gameId as unknown as ClassifiedGameId;
  return {
    gameId: gameIdBranded,
    version: 1,
    toJSON(state) {
      return encode(state, config, allowKing);
    },
    fromJSON(json) {
      return decode(json, config, allowKing);
    },
  };
}

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

function encode(
  state: CustodianGameState,
  config: CustodianConfig,
  allowKing: boolean,
): CustodianPersistedV1 {
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
      (kind !== 'man' && kind !== 'king')
    ) {
      throw new CustodianSerializerCorruptionError(
        config.gameId,
        `unknown piece at NodeId ${String(i)}: owner=${owner} kind=${kind}`,
      );
    }
    if (kind === 'king' && !allowKing) {
      throw new CustodianSerializerCorruptionError(
        config.gameId,
        `king piece at NodeId ${String(i)} but config does not allow kings`,
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
    squares: cells.join(''),
    moveHistory: state.moveHistory.map((m) => encodeMove(m as CustodianMove)),
    repetitionTable: state.meta.repetitionTable.map(
      ([h, c]): readonly [string, number] => [h, c],
    ),
    winningLines: state.meta.winningLines ?? null,
  };
}

function encodeMove(move: CustodianMove): CustodianMoveJSON {
  const out: {
    kind: CustodianMoveKind;
    from: string;
    to: string;
    piece: CustodianPieceKind;
    capture: readonly string[];
    meta?: {
      owner?: CustodianOwner;
      fromNode?: number;
      toNode?: number;
      captureBreakdown?: {
        custodian?: readonly number[];
        intervention?: readonly number[];
        corner?: readonly number[];
        immobilization?: readonly number[];
        line?: readonly number[];
      };
      winningLine?: readonly number[];
    };
  } = {
    kind: move.kind,
    from: move.from,
    to: move.to,
    piece: move.piece,
    capture: [...move.capture],
  };
  if (move.meta) {
    const meta: {
      owner?: CustodianOwner;
      fromNode?: number;
      toNode?: number;
      captureBreakdown?: {
        custodian?: readonly number[];
        intervention?: readonly number[];
        corner?: readonly number[];
        immobilization?: readonly number[];
        line?: readonly number[];
      };
      winningLine?: readonly number[];
    } = {};
    if (move.meta.owner) meta.owner = move.meta.owner;
    if (move.meta.fromNode !== undefined) meta.fromNode = move.meta.fromNode;
    if (move.meta.toNode !== undefined) meta.toNode = move.meta.toNode;
    if (move.meta.captureBreakdown) {
      const cb = move.meta.captureBreakdown;
      const breakdown: {
        custodian?: readonly number[];
        intervention?: readonly number[];
        corner?: readonly number[];
        immobilization?: readonly number[];
        line?: readonly number[];
      } = {};
      if (cb.custodian) breakdown.custodian = [...cb.custodian];
      if (cb.intervention) breakdown.intervention = [...cb.intervention];
      if (cb.corner) breakdown.corner = [...cb.corner];
      if (cb.immobilization) breakdown.immobilization = [...cb.immobilization];
      if (cb.line) breakdown.line = [...cb.line];
      meta.captureBreakdown = breakdown;
    }
    if (move.meta.winningLine) meta.winningLine = [...move.meta.winningLine];
    out.meta = meta;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

function decode(
  json: unknown,
  config: CustodianConfig,
  allowKing: boolean,
): CustodianGameState {
  if (typeof json !== 'object' || json === null) {
    throw new CustodianSerializerCorruptionError(config.gameId, 'payload is not an object');
  }
  const obj = json as Record<string, unknown>;
  if (obj.serializationType !== 'standard') {
    throw new CustodianSerializerCorruptionError(
      config.gameId,
      `expected serializationType "standard", got ${String(obj.serializationType)}`,
    );
  }
  if (obj.schemaVersion !== 1) {
    throw new CustodianSerializerCorruptionError(
      config.gameId,
      `unsupported schemaVersion ${String(obj.schemaVersion)}`,
    );
  }
  if (obj.gameId !== config.gameId) {
    throw new CustodianSerializerCorruptionError(
      config.gameId,
      `gameId mismatch: payload says "${String(obj.gameId)}"`,
    );
  }
  if (obj.boardSize !== config.boardSize) {
    throw new CustodianSerializerCorruptionError(
      config.gameId,
      `boardSize mismatch: payload says ${String(obj.boardSize)}`,
    );
  }
  const turn = obj.turn;
  if (turn !== 'white' && turn !== 'black') {
    throw new CustodianSerializerCorruptionError(config.gameId, `invalid turn: ${String(turn)}`);
  }
  const cells = obj.squares;
  if (typeof cells !== 'string') {
    throw new CustodianSerializerCorruptionError(config.gameId, 'squares missing or non-string');
  }
  const expectedLen = config.boardSize * config.boardSize;
  if (cells.length !== expectedLen) {
    throw new CustodianSerializerCorruptionError(
      config.gameId,
      `squares string length ${String(cells.length)} ≠ expected ${String(expectedLen)}`,
    );
  }

  const pieces = new Map<NodeId, ClassifiedPiece>();
  for (let i = 0; i < expectedLen; i += 1) {
    const ch = cells[i];
    if (ch === undefined) {
      throw new CustodianSerializerCorruptionError(config.gameId, 'squares string truncated');
    }
    if (ch === '_') continue;
    const piece = CHAR_TO_PIECE[ch];
    if (!piece) {
      throw new CustodianSerializerCorruptionError(
        config.gameId,
        `unknown square character "${ch}" at index ${String(i)}`,
      );
    }
    if (piece.kind === 'king' && !allowKing) {
      throw new CustodianSerializerCorruptionError(
        config.gameId,
        `king character "${ch}" at index ${String(i)} but config does not allow kings`,
      );
    }
    pieces.set(i as unknown as NodeId, piece);
  }

  const halfMoveClock = obj.halfMoveClock;
  if (typeof halfMoveClock !== 'number' || !Number.isInteger(halfMoveClock) || halfMoveClock < 0) {
    throw new CustodianSerializerCorruptionError(config.gameId, 'halfMoveClock invalid');
  }
  const plyCount = obj.plyCount;
  if (typeof plyCount !== 'number' || !Number.isInteger(plyCount) || plyCount < 0) {
    throw new CustodianSerializerCorruptionError(config.gameId, 'plyCount invalid');
  }

  const moveHistoryRaw = obj.moveHistory;
  if (!Array.isArray(moveHistoryRaw)) {
    throw new CustodianSerializerCorruptionError(config.gameId, 'moveHistory not an array');
  }
  const moveHistory = moveHistoryRaw.map((m, i) => decodeMove(m, config, i));

  const repetitionRaw = obj.repetitionTable;
  if (!Array.isArray(repetitionRaw)) {
    throw new CustodianSerializerCorruptionError(config.gameId, 'repetitionTable not an array');
  }
  const repetitionTable = repetitionRaw.map((entry, i): readonly [string, number] => {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new CustodianSerializerCorruptionError(
        config.gameId,
        `repetitionTable[${String(i)}] not a [hex, count] tuple`,
      );
    }
    const hex: unknown = entry[0];
    const count: unknown = entry[1];
    if (typeof hex !== 'string' || !/^[0-9a-f]{16}$/.test(hex)) {
      throw new CustodianSerializerCorruptionError(
        config.gameId,
        `repetitionTable[${String(i)}] hex malformed`,
      );
    }
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
      throw new CustodianSerializerCorruptionError(
        config.gameId,
        `repetitionTable[${String(i)}] count malformed`,
      );
    }
    return Object.freeze([hex, count]);
  });

  const winningLinesRaw = obj.winningLines;
  let winningLines: readonly (readonly number[])[] | null = null;
  if (winningLinesRaw !== null && winningLinesRaw !== undefined) {
    if (!Array.isArray(winningLinesRaw)) {
      throw new CustodianSerializerCorruptionError(config.gameId, 'winningLines not an array');
    }
    winningLines = winningLinesRaw.map((line, i): readonly number[] => {
      if (!Array.isArray(line)) {
        throw new CustodianSerializerCorruptionError(
          config.gameId,
          `winningLines[${String(i)}] not an array`,
        );
      }
      return line.map((n): number => {
        if (typeof n !== 'number' || !Number.isInteger(n)) {
          throw new CustodianSerializerCorruptionError(
            config.gameId,
            `winningLines[${String(i)}] entry not int`,
          );
        }
        return n;
      });
    });
  }

  const meta: CustodianMeta = {
    turnTag: turn,
    halfMoveClock,
    repetitionTable: Object.freeze(repetitionTable),
    winningLines,
  };

  return {
    pieces,
    turn,
    plyCount,
    moveHistory: Object.freeze(moveHistory),
    meta,
  };
}

function decodeMove(raw: unknown, config: CustodianConfig, index: number): CustodianMove {
  if (typeof raw !== 'object' || raw === null) {
    throw new CustodianSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}] not an object`,
    );
  }
  const m = raw as Record<string, unknown>;
  if (m.kind !== 'slide' && m.kind !== 'jump') {
    throw new CustodianSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}].kind invalid: ${String(m.kind)}`,
    );
  }
  const from = m.from;
  const to = m.to;
  const piece = m.piece;
  if (typeof from !== 'string' || typeof to !== 'string') {
    throw new CustodianSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}] from/to not strings`,
    );
  }
  if (piece !== 'man' && piece !== 'king') {
    throw new CustodianSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}].piece invalid`,
    );
  }
  const captureRaw = m.capture;
  if (!Array.isArray(captureRaw)) {
    throw new CustodianSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}].capture not array`,
    );
  }
  const capture = captureRaw.map((c) => {
    if (typeof c !== 'string') {
      throw new CustodianSerializerCorruptionError(
        config.gameId,
        `moveHistory[${String(index)}].capture entry not string`,
      );
    }
    return c;
  });
  const baseMove: {
    kind: CustodianMoveKind;
    from: string;
    to: string;
    piece: CustodianPieceKind;
    capture: readonly string[];
    meta?: NonNullable<CustodianMove['meta']>;
  } = {
    kind: m.kind,
    from,
    to,
    piece,
    capture,
  };
  if (m.meta && typeof m.meta === 'object') {
    const metaRaw = m.meta as Record<string, unknown>;
    const meta: {
      owner?: CustodianOwner;
      fromNode?: number;
      toNode?: number;
      captureBreakdown?: {
        custodian?: readonly number[];
        intervention?: readonly number[];
        corner?: readonly number[];
        immobilization?: readonly number[];
        line?: readonly number[];
      };
      winningLine?: readonly number[];
    } = {};
    if (metaRaw.owner === 'white' || metaRaw.owner === 'black') meta.owner = metaRaw.owner;
    if (typeof metaRaw.fromNode === 'number' && Number.isInteger(metaRaw.fromNode)) {
      meta.fromNode = metaRaw.fromNode;
    }
    if (typeof metaRaw.toNode === 'number' && Number.isInteger(metaRaw.toNode)) {
      meta.toNode = metaRaw.toNode;
    }
    if (metaRaw.captureBreakdown && typeof metaRaw.captureBreakdown === 'object') {
      const cbRaw = metaRaw.captureBreakdown as Record<string, unknown>;
      const breakdown: {
        custodian?: readonly number[];
        intervention?: readonly number[];
        corner?: readonly number[];
        immobilization?: readonly number[];
        line?: readonly number[];
      } = {};
      for (const key of ['custodian', 'intervention', 'corner', 'immobilization', 'line'] as const) {
        const arr = cbRaw[key];
        if (Array.isArray(arr)) {
          breakdown[key] = arr.map((n) => {
            if (typeof n !== 'number' || !Number.isInteger(n)) {
              throw new CustodianSerializerCorruptionError(
                config.gameId,
                `moveHistory[${String(index)}].meta.captureBreakdown.${key} entry not int`,
              );
            }
            return n;
          });
        }
      }
      meta.captureBreakdown = breakdown;
    }
    if (Array.isArray(metaRaw.winningLine)) {
      meta.winningLine = metaRaw.winningLine.map((n) => {
        if (typeof n !== 'number' || !Number.isInteger(n)) {
          throw new CustodianSerializerCorruptionError(
            config.gameId,
            `moveHistory[${String(index)}].meta.winningLine entry not int`,
          );
        }
        return n;
      });
    }
    baseMove.meta = meta;
  }
  return baseMove;
}
