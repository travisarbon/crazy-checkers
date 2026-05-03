/**
 * Harzdame serializer (Phase 4 Task 29.5).
 *
 * Per playbook §7.3 'standard' format with an extended piece alphabet to
 * accommodate the senior-king mechanic:
 *
 *   - `_` empty
 *   - `m` / `b` white-man / black-man
 *   - `M` / `B` white-king / black-king (regular)
 *   - `S` / `s` white-senior-king / black-senior-king
 *
 * Length: 32 chars (one per dark square in PDN order 1..32).
 *
 * The senior-king alphabet entries (`S`, `s`) are the structural reason
 * Harzdame's serializer is bespoke rather than reusing a Tier 1 standard
 * piece serializer.
 *
 * Round-trip guarantee: `deserialize(serialize(state))` deep-equals `state`
 * (including `meta.repetitionTable`, `moveHistory`, every `pieces` entry's
 * `kind`/`promoted`).
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type { GameStateSerializer } from '../../../persistence/serializers/types';
import type { ClassifiedGameId } from '../ClassifiedRuleSet';
import type { DraughtsDirection } from '../draughts/DraughtsConfig';
import type {
  HarzdameConfig,
  HarzdameGameState,
  HarzdameMeta,
  HarzdameMove,
  HarzdameMoveKind,
  HarzdameOwner,
  HarzdamePieceKind,
} from './types';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class HarzdameSerializerCorruptionError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`[harzdame] serializer corruption: ${reason}`);
    this.name = 'HarzdameSerializerCorruptionError';
    this.reason = reason;
  }
}

// ---------------------------------------------------------------------------
// Square alphabet
// ---------------------------------------------------------------------------

const PIECE_TO_CHAR = (
  owner: HarzdameOwner,
  kind: HarzdamePieceKind,
  promoted: boolean,
): string => {
  if (kind === 'man') return owner === 'white' ? 'm' : 'b';
  if (!promoted) return owner === 'white' ? 'M' : 'B';
  return owner === 'white' ? 'S' : 's';
};

const CHAR_TO_PIECE: Record<string, ClassifiedPiece> = Object.freeze({
  m: Object.freeze({ owner: 'white', kind: 'man' }),
  M: Object.freeze({ owner: 'white', kind: 'king' }),
  S: Object.freeze({ owner: 'white', kind: 'king', promoted: true }),
  b: Object.freeze({ owner: 'black', kind: 'man' }),
  B: Object.freeze({ owner: 'black', kind: 'king' }),
  s: Object.freeze({ owner: 'black', kind: 'king', promoted: true }),
});

// ---------------------------------------------------------------------------
// Persisted shape
// ---------------------------------------------------------------------------

interface HarzdamePersistedV1 {
  readonly schemaVersion: 1;
  readonly gameId: 'harzdame';
  readonly serializationType: 'standard';
  readonly boardSize: 8;
  readonly turn: HarzdameOwner;
  readonly halfMoveClock: number;
  readonly plyCount: number;
  /** 32 chars, one per dark square in PDN order 1..32. */
  readonly squares: string;
  readonly moveHistory: readonly HarzdameMoveJSON[];
  readonly repetitionTable: readonly (readonly [string, number])[];
  /** Optional cache derived from squares; null when no senior kings present. */
  readonly seniorKings: readonly number[] | null;
}

interface HarzdameMoveJSON {
  readonly kind: HarzdameMoveKind;
  readonly from: string;
  readonly to: string;
  readonly piece: HarzdamePieceKind;
  readonly capture: readonly string[];
  readonly promotion?: 'king' | 'senior';
  readonly meta?: {
    readonly owner?: HarzdameOwner;
    readonly fromNode?: number;
    readonly toNode?: number;
    readonly path?: readonly number[];
    readonly directions?: readonly DraughtsDirection[];
    readonly maxChainLength?: number;
  };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function createHarzdameSerializer(
  config: HarzdameConfig,
): GameStateSerializer<HarzdameGameState> & { readonly gameId: ClassifiedGameId } {
  const allowSenior = config.seniorKing.enabled;
  const gameIdBranded = config.gameId as unknown as ClassifiedGameId;
  // Build PDN-1..32 → NodeId index map upfront (geometry-aware).
  const pdnNodeOrder: NodeId[] = [];
  for (let pdn = 1; pdn <= 32; pdn += 1) {
    const node = config.boardGeometry.coordinateLabels.parseNotation(String(pdn));
    if (node === null) {
      throw new HarzdameSerializerCorruptionError(
        `geometry does not support PDN ${String(pdn)}`,
      );
    }
    pdnNodeOrder.push(node);
  }
  return {
    gameId: gameIdBranded,
    version: 1,
    toJSON(state) {
      return encode(state, config, pdnNodeOrder, allowSenior);
    },
    fromJSON(json) {
      return decode(json, config, pdnNodeOrder, allowSenior);
    },
  };
}

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

function encode(
  state: HarzdameGameState,
  config: HarzdameConfig,
  pdnNodeOrder: readonly NodeId[],
  allowSenior: boolean,
): HarzdamePersistedV1 {
  void config;
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
      (kind !== 'man' && kind !== 'king')
    ) {
      throw new HarzdameSerializerCorruptionError(
        `unknown piece at PDN ${String(i + 1)}: owner=${owner} kind=${kind}`,
      );
    }
    const promoted = piece.promoted === true;
    if (promoted && !allowSenior) {
      throw new HarzdameSerializerCorruptionError(
        `senior-king at PDN ${String(i + 1)} but config has seniorKing.enabled=false`,
      );
    }
    cells[i] = PIECE_TO_CHAR(owner, kind, promoted);
  }

  const seniorKings: number[] = [];
  for (const [nodeId, piece] of state.pieces) {
    if (piece.kind === 'king' && piece.promoted === true) {
      seniorKings.push(nodeId as unknown as number);
    }
  }
  seniorKings.sort((a, b) => a - b);

  return {
    schemaVersion: 1,
    gameId: 'harzdame',
    serializationType: 'standard',
    boardSize: 8,
    turn: state.turn,
    halfMoveClock: state.meta.halfMoveClock,
    plyCount: state.plyCount,
    squares: cells.join(''),
    moveHistory: state.moveHistory.map((m) => encodeMove(m as HarzdameMove)),
    repetitionTable: state.meta.repetitionTable.map(
      ([h, c]): readonly [string, number] => [h, c],
    ),
    seniorKings: seniorKings.length > 0 ? seniorKings : null,
  };
}

function encodeMove(move: HarzdameMove): HarzdameMoveJSON {
  const out: {
    kind: HarzdameMoveKind;
    from: string;
    to: string;
    piece: HarzdamePieceKind;
    capture: readonly string[];
    promotion?: 'king' | 'senior';
    meta?: {
      owner?: HarzdameOwner;
      fromNode?: number;
      toNode?: number;
      path?: readonly number[];
      directions?: readonly DraughtsDirection[];
      maxChainLength?: number;
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
      owner?: HarzdameOwner;
      fromNode?: number;
      toNode?: number;
      path?: readonly number[];
      directions?: readonly DraughtsDirection[];
      maxChainLength?: number;
    } = {};
    if (move.meta.owner) meta.owner = move.meta.owner;
    if (move.meta.fromNode !== undefined) meta.fromNode = move.meta.fromNode;
    if (move.meta.toNode !== undefined) meta.toNode = move.meta.toNode;
    if (move.meta.path) meta.path = [...move.meta.path];
    if (move.meta.directions) meta.directions = [...move.meta.directions];
    if (move.meta.maxChainLength !== undefined) meta.maxChainLength = move.meta.maxChainLength;
    out.meta = meta;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

function decode(
  json: unknown,
  config: HarzdameConfig,
  pdnNodeOrder: readonly NodeId[],
  allowSenior: boolean,
): HarzdameGameState {
  if (typeof json !== 'object' || json === null) {
    throw new HarzdameSerializerCorruptionError('payload is not an object');
  }
  const obj = json as Record<string, unknown>;
  if (obj.serializationType !== 'standard') {
    throw new HarzdameSerializerCorruptionError(
      `expected serializationType "standard", got ${String(obj.serializationType)}`,
    );
  }
  if (obj.schemaVersion !== 1) {
    throw new HarzdameSerializerCorruptionError(
      `unsupported schemaVersion ${String(obj.schemaVersion)}`,
    );
  }
  if (obj.gameId !== 'harzdame') {
    throw new HarzdameSerializerCorruptionError(
      `gameId mismatch: payload says "${String(obj.gameId)}"`,
    );
  }
  if (obj.boardSize !== 8) {
    throw new HarzdameSerializerCorruptionError(
      `boardSize mismatch: payload says ${String(obj.boardSize)}`,
    );
  }
  const turn = obj.turn;
  if (turn !== 'white' && turn !== 'black') {
    throw new HarzdameSerializerCorruptionError(`invalid turn: ${String(turn)}`);
  }
  const cells = obj.squares;
  if (typeof cells !== 'string') {
    throw new HarzdameSerializerCorruptionError('squares missing or non-string');
  }
  if (cells.length !== 32) {
    throw new HarzdameSerializerCorruptionError(
      `squares string length ${String(cells.length)} ≠ expected 32`,
    );
  }

  const pieces = new Map<NodeId, ClassifiedPiece>();
  for (let i = 0; i < 32; i += 1) {
    const ch = cells[i];
    if (ch === undefined) {
      throw new HarzdameSerializerCorruptionError('squares string truncated');
    }
    if (ch === '_') continue;
    const piece = CHAR_TO_PIECE[ch];
    if (!piece) {
      throw new HarzdameSerializerCorruptionError(
        `unknown square character "${ch}" at index ${String(i)}`,
      );
    }
    if (piece.promoted === true && !allowSenior) {
      throw new HarzdameSerializerCorruptionError(
        `senior-king char "${ch}" at PDN ${String(i + 1)} but config has seniorKing.enabled=false`,
      );
    }
    const node = pdnNodeOrder[i] as NodeId;
    pieces.set(node, piece);
  }

  const halfMoveClock = obj.halfMoveClock;
  if (typeof halfMoveClock !== 'number' || !Number.isInteger(halfMoveClock) || halfMoveClock < 0) {
    throw new HarzdameSerializerCorruptionError('halfMoveClock invalid');
  }
  const plyCount = obj.plyCount;
  if (typeof plyCount !== 'number' || !Number.isInteger(plyCount) || plyCount < 0) {
    throw new HarzdameSerializerCorruptionError('plyCount invalid');
  }

  const moveHistoryRaw = obj.moveHistory;
  if (!Array.isArray(moveHistoryRaw)) {
    throw new HarzdameSerializerCorruptionError('moveHistory not an array');
  }
  const moveHistory = moveHistoryRaw.map((m, i) => decodeMove(m, i));

  const repetitionRaw = obj.repetitionTable;
  if (!Array.isArray(repetitionRaw)) {
    throw new HarzdameSerializerCorruptionError('repetitionTable not an array');
  }
  const repetitionTable = repetitionRaw.map((entry, i): readonly [string, number] => {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new HarzdameSerializerCorruptionError(
        `repetitionTable[${String(i)}] not a [hex, count] tuple`,
      );
    }
    const hex: unknown = entry[0];
    const count: unknown = entry[1];
    if (typeof hex !== 'string' || !/^[0-9a-f]{16}$/.test(hex)) {
      throw new HarzdameSerializerCorruptionError(
        `repetitionTable[${String(i)}] hex malformed`,
      );
    }
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
      throw new HarzdameSerializerCorruptionError(
        `repetitionTable[${String(i)}] count malformed`,
      );
    }
    return Object.freeze([hex, count]);
  });

  // seniorKings is just a re-derivable cache; recompute from pieces for canonicalization.
  const seniorKings: number[] = [];
  for (const [nodeId, piece] of pieces) {
    if (piece.kind === 'king' && piece.promoted === true) {
      seniorKings.push(nodeId as unknown as number);
    }
  }
  seniorKings.sort((a, b) => a - b);

  // Validate optional payload winningLines-equivalent (here: seniorKings cache).
  const seniorKingsRaw = obj.seniorKings;
  if (seniorKingsRaw !== null && seniorKingsRaw !== undefined) {
    if (!Array.isArray(seniorKingsRaw)) {
      throw new HarzdameSerializerCorruptionError('seniorKings not an array');
    }
    for (const n of seniorKingsRaw) {
      if (typeof n !== 'number' || !Number.isInteger(n)) {
        throw new HarzdameSerializerCorruptionError('seniorKings entry not int');
      }
    }
  }

  void config;

  const meta: HarzdameMeta = {
    turnTag: turn,
    halfMoveClock,
    repetitionTable: Object.freeze(repetitionTable),
    seniorKings: Object.freeze(seniorKings),
  };

  return {
    pieces,
    turn,
    plyCount,
    moveHistory: Object.freeze(moveHistory),
    meta,
  };
}

function decodeMove(raw: unknown, index: number): HarzdameMove {
  if (typeof raw !== 'object' || raw === null) {
    throw new HarzdameSerializerCorruptionError(
      `moveHistory[${String(index)}] not an object`,
    );
  }
  const m = raw as Record<string, unknown>;
  if (m.kind !== 'move' && m.kind !== 'capture') {
    throw new HarzdameSerializerCorruptionError(
      `moveHistory[${String(index)}].kind invalid: ${String(m.kind)}`,
    );
  }
  const from = m.from;
  const to = m.to;
  const piece = m.piece;
  if (typeof from !== 'string' || typeof to !== 'string') {
    throw new HarzdameSerializerCorruptionError(
      `moveHistory[${String(index)}] from/to not strings`,
    );
  }
  if (piece !== 'man' && piece !== 'king') {
    throw new HarzdameSerializerCorruptionError(
      `moveHistory[${String(index)}].piece invalid`,
    );
  }
  const captureRaw = m.capture;
  if (!Array.isArray(captureRaw)) {
    throw new HarzdameSerializerCorruptionError(
      `moveHistory[${String(index)}].capture not array`,
    );
  }
  const capture = captureRaw.map((c) => {
    if (typeof c !== 'string') {
      throw new HarzdameSerializerCorruptionError(
        `moveHistory[${String(index)}].capture entry not string`,
      );
    }
    return c;
  });
  const baseMove: {
    kind: HarzdameMoveKind;
    from: string;
    to: string;
    piece: HarzdamePieceKind;
    capture: readonly string[];
    promotion?: 'king' | 'senior';
    meta?: NonNullable<HarzdameMove['meta']>;
  } = {
    kind: m.kind,
    from,
    to,
    piece,
    capture,
  };
  if (m.promotion === 'king' || m.promotion === 'senior') {
    baseMove.promotion = m.promotion;
  }
  if (m.meta && typeof m.meta === 'object') {
    const metaRaw = m.meta as Record<string, unknown>;
    const meta: {
      owner?: HarzdameOwner;
      fromNode?: number;
      toNode?: number;
      path?: readonly number[];
      directions?: readonly DraughtsDirection[];
      maxChainLength?: number;
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
          throw new HarzdameSerializerCorruptionError(
            `moveHistory[${String(index)}].meta.path entry not int`,
          );
        }
        return n;
      });
    }
    if (Array.isArray(metaRaw.directions)) {
      meta.directions = metaRaw.directions.map((d) => {
        if (typeof d !== 'string') {
          throw new HarzdameSerializerCorruptionError(
            `moveHistory[${String(index)}].meta.directions entry not string`,
          );
        }
        return d as DraughtsDirection;
      });
    }
    if (typeof metaRaw.maxChainLength === 'number' && Number.isInteger(metaRaw.maxChainLength)) {
      meta.maxChainLength = metaRaw.maxChainLength;
    }
    baseMove.meta = meta;
  }
  return baseMove;
}
