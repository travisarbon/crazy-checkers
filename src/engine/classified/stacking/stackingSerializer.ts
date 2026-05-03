/**
 * Stacking-draughts serializer (Phase 4 Task 29.1).
 *
 * Tower text encoding per Task 29.1 plan §9.1:
 *   - Empty playable square → `_`.
 *   - Tower → `T[<l1><l2>...]` where each layer is one of `m | M | b | B`
 *     (white-man, white-king, black-man, black-king). Bottom-first ordering;
 *     commander is the last character.
 *
 * Squares are emitted in canonical order (PDN counting, sorted ascending by
 * `coordinateLabels.notationOf` — i.e., 1..25 for Lasca, 1..32 for Bashni).
 * The board encoding is the comma-separated join of these tokens (length =
 * playable square count).
 *
 * Round-trip guarantee: `deserialize(serialize(state))` is structurally equal
 * to `state` (deep equality on every field, including `meta.repetitionTable`).
 * Output is deterministic — re-encoding the same state always produces the
 * identical string.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type { GameStateSerializer } from '../../../persistence/serializers/types';
import type {
  StackingDraughtsConfig,
  StackingGameState,
  StackingMeta,
  StackingMove,
  StackingOwner,
  StackingPiece,
  StackingPieceKind,
} from './types';
import { fromClassifiedPiece, toClassifiedPiece, makeStack } from './StackState';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class StackingSerializerCorruptionError extends Error {
  readonly gameId: 'lasca' | 'bashni';
  readonly reason: string;
  constructor(gameId: 'lasca' | 'bashni', reason: string) {
    super(`[${gameId}] stacking serializer corruption: ${reason}`);
    this.name = 'StackingSerializerCorruptionError';
    this.gameId = gameId;
    this.reason = reason;
  }
}

// ---------------------------------------------------------------------------
// Layer alphabet
// ---------------------------------------------------------------------------

const LAYER_TO_CHAR: Record<StackingOwner, Record<StackingPieceKind, string>> = {
  white: { man: 'm', king: 'M' },
  black: { man: 'b', king: 'B' },
};

const CHAR_TO_LAYER: Record<string, StackingPiece> = Object.freeze({
  m: { owner: 'white', kind: 'man' },
  M: { owner: 'white', kind: 'king' },
  b: { owner: 'black', kind: 'man' },
  B: { owner: 'black', kind: 'king' },
});

// ---------------------------------------------------------------------------
// Persisted shape
// ---------------------------------------------------------------------------

interface StackingPersistedV1 {
  readonly schemaVersion: 1;
  readonly gameId: 'lasca' | 'bashni';
  readonly serializationType: 'tower';
  readonly boardSize: 7 | 8;
  readonly turn: StackingOwner;
  readonly halfMoveClock: number;
  readonly squares: string;
  readonly moveHistory: readonly StackingMoveJSON[];
  readonly repetitionTable: readonly (readonly [string, number])[];
  readonly plyCount: number;
}

interface StackingMoveJSON {
  readonly kind: 'step' | 'capture';
  readonly from: string;
  readonly to: string;
  readonly piece: StackingPieceKind;
  readonly capture: readonly string[];
  readonly promotion?: 'king';
  readonly meta?: {
    readonly owner?: StackingOwner;
    readonly promotionSquare?: string;
    readonly path?: readonly number[];
  };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function createStackingSerializer(
  config: StackingDraughtsConfig,
): GameStateSerializer<StackingGameState> & { readonly gameId: import('../ClassifiedRuleSet').ClassifiedGameId } {
  const playableNodes = orderedPlayableNodes(config);
  const gameIdBranded = config.gameId as unknown as import('../ClassifiedRuleSet').ClassifiedGameId;
  return {
    gameId: gameIdBranded,
    version: 1,
    toJSON(state) {
      return encode(state, config, playableNodes);
    },
    fromJSON(json) {
      return decode(json, config, playableNodes);
    },
  };
}

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

function encode(
  state: StackingGameState,
  config: StackingDraughtsConfig,
  playableNodes: readonly NodeId[],
): StackingPersistedV1 {
  const tokens: string[] = [];
  for (const node of playableNodes) {
    const piece = state.pieces.get(node);
    if (!piece) {
      tokens.push('_');
      continue;
    }
    tokens.push(encodeTower(piece, config));
  }
  const moveHistory = state.moveHistory.map((m) => encodeMove(m as StackingMove));

  return {
    schemaVersion: 1,
    gameId: config.gameId,
    serializationType: 'tower',
    boardSize: config.boardSize,
    turn: state.turn,
    halfMoveClock: state.meta.halfMoveClock,
    squares: tokens.join(','),
    moveHistory,
    repetitionTable: state.meta.repetitionTable.map(
      ([h, c]): readonly [string, number] => [h, c],
    ),
    plyCount: state.plyCount,
  };
}

function encodeTower(piece: ClassifiedPiece, config: StackingDraughtsConfig): string {
  const tower = fromClassifiedPiece(piece);
  let body = '';
  for (const layer of tower.pieces) {
    body += LAYER_TO_CHAR[layer.owner][layer.kind];
  }
  if (body.length === 0) {
    throw new StackingSerializerCorruptionError(
      config.gameId,
      'attempted to encode an empty tower',
    );
  }
  return `T[${body}]`;
}

function encodeMove(move: StackingMove): StackingMoveJSON {
  const out: {
    kind: 'step' | 'capture';
    from: string;
    to: string;
    piece: StackingPieceKind;
    capture: readonly string[];
    promotion?: 'king';
    meta?: {
      owner?: StackingOwner;
      promotionSquare?: string;
      path?: readonly number[];
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
      owner?: StackingOwner;
      promotionSquare?: string;
      path?: readonly number[];
    } = {};
    if (move.meta.owner) meta.owner = move.meta.owner;
    if (move.meta.promotionSquare) meta.promotionSquare = move.meta.promotionSquare;
    if (move.meta.path) meta.path = [...move.meta.path];
    out.meta = meta;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

function decode(
  json: unknown,
  config: StackingDraughtsConfig,
  playableNodes: readonly NodeId[],
): StackingGameState {
  if (typeof json !== 'object' || json === null) {
    throw new StackingSerializerCorruptionError(config.gameId, 'payload is not an object');
  }
  const obj = json as Record<string, unknown>;
  if (obj.serializationType !== 'tower') {
    throw new StackingSerializerCorruptionError(
      config.gameId,
      `expected serializationType "tower", got ${String(obj.serializationType)}`,
    );
  }
  if (obj.schemaVersion !== 1) {
    throw new StackingSerializerCorruptionError(
      config.gameId,
      `unsupported schemaVersion ${String(obj.schemaVersion)}`,
    );
  }
  if (obj.gameId !== config.gameId) {
    throw new StackingSerializerCorruptionError(
      config.gameId,
      `gameId mismatch: payload says "${String(obj.gameId)}"`,
    );
  }
  if (obj.boardSize !== config.boardSize) {
    throw new StackingSerializerCorruptionError(
      config.gameId,
      `boardSize mismatch: payload says ${String(obj.boardSize)}`,
    );
  }
  const turn = obj.turn;
  if (turn !== 'white' && turn !== 'black') {
    throw new StackingSerializerCorruptionError(config.gameId, `invalid turn: ${String(turn)}`);
  }
  const squares = obj.squares;
  if (typeof squares !== 'string') {
    throw new StackingSerializerCorruptionError(config.gameId, 'squares missing or non-string');
  }
  const tokens = squares.split(',');
  if (tokens.length !== playableNodes.length) {
    throw new StackingSerializerCorruptionError(
      config.gameId,
      `expected ${String(playableNodes.length)} square tokens, got ${String(tokens.length)}`,
    );
  }

  const pieces = new Map<NodeId, ClassifiedPiece>();
  for (let i = 0; i < playableNodes.length; i += 1) {
    const token = tokens[i];
    const node = playableNodes[i];
    if (token === undefined || node === undefined) {
      throw new StackingSerializerCorruptionError(config.gameId, 'token/node alignment lost');
    }
    if (token === '_') continue;
    const tower = decodeTower(token, config);
    pieces.set(node, toClassifiedPiece(tower));
  }

  const moveHistoryRaw = obj.moveHistory;
  if (!Array.isArray(moveHistoryRaw)) {
    throw new StackingSerializerCorruptionError(config.gameId, 'moveHistory not an array');
  }
  const moveHistory = moveHistoryRaw.map((m, i) => decodeMove(m, config, i));

  const repetitionRaw = obj.repetitionTable;
  if (!Array.isArray(repetitionRaw)) {
    throw new StackingSerializerCorruptionError(config.gameId, 'repetitionTable not an array');
  }
  const repetitionTable = repetitionRaw.map((entry, i): readonly [string, number] => {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new StackingSerializerCorruptionError(
        config.gameId,
        `repetitionTable[${String(i)}] not a [hex, count] tuple`,
      );
    }
    const hex: unknown = entry[0];
    const count: unknown = entry[1];
    if (typeof hex !== 'string' || !/^[0-9a-f]{16}$/.test(hex)) {
      throw new StackingSerializerCorruptionError(
        config.gameId,
        `repetitionTable[${String(i)}] hex malformed`,
      );
    }
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
      throw new StackingSerializerCorruptionError(
        config.gameId,
        `repetitionTable[${String(i)}] count malformed`,
      );
    }
    return Object.freeze([hex, count]);
  });

  const halfMoveClock = obj.halfMoveClock;
  if (typeof halfMoveClock !== 'number' || !Number.isInteger(halfMoveClock) || halfMoveClock < 0) {
    throw new StackingSerializerCorruptionError(config.gameId, 'halfMoveClock invalid');
  }
  const plyCount = obj.plyCount;
  if (typeof plyCount !== 'number' || !Number.isInteger(plyCount) || plyCount < 0) {
    throw new StackingSerializerCorruptionError(config.gameId, 'plyCount invalid');
  }

  const meta: StackingMeta = {
    stackingTurn: turn,
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

function decodeTower(
  token: string,
  config: StackingDraughtsConfig,
): import('./types').StackState {
  const m = /^T\[([mMbB]+)\]$/.exec(token);
  if (!m) {
    throw new StackingSerializerCorruptionError(
      config.gameId,
      `tower token does not match T[m|M|b|B]+ pattern: "${token}"`,
    );
  }
  const body = m[1] ?? '';
  const layers: StackingPiece[] = [];
  for (const ch of body) {
    const layer = CHAR_TO_LAYER[ch];
    if (!layer) {
      throw new StackingSerializerCorruptionError(
        config.gameId,
        `unknown layer char "${ch}" in tower "${token}"`,
      );
    }
    layers.push(layer);
  }
  return makeStack(layers);
}

function decodeMove(
  raw: unknown,
  config: StackingDraughtsConfig,
  index: number,
): StackingMove {
  if (typeof raw !== 'object' || raw === null) {
    throw new StackingSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}] not an object`,
    );
  }
  const m = raw as Record<string, unknown>;
  if (m.kind !== 'step' && m.kind !== 'capture') {
    throw new StackingSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}].kind invalid`,
    );
  }
  const from = m.from;
  const to = m.to;
  const piece = m.piece;
  if (typeof from !== 'string' || typeof to !== 'string') {
    throw new StackingSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}] from/to not strings`,
    );
  }
  if (piece !== 'man' && piece !== 'king') {
    throw new StackingSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}].piece invalid`,
    );
  }
  const captureRaw = m.capture;
  if (!Array.isArray(captureRaw)) {
    throw new StackingSerializerCorruptionError(
      config.gameId,
      `moveHistory[${String(index)}].capture not array`,
    );
  }
  const capture = captureRaw.map((c) => {
    if (typeof c !== 'string') {
      throw new StackingSerializerCorruptionError(
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
    piece: StackingPieceKind;
    capture: readonly string[];
    promotion?: 'king';
    meta?: NonNullable<StackingMove['meta']>;
  } = {
    kind: m.kind,
    from,
    to,
    piece,
    capture,
  };
  if (m.promotion === 'king') baseMove.promotion = 'king';
  if (m.meta && typeof m.meta === 'object') {
    const metaRaw = m.meta as Record<string, unknown>;
    const meta: {
      owner?: StackingOwner;
      promotionSquare?: string;
      path?: readonly number[];
    } = {};
    if (metaRaw.owner === 'white' || metaRaw.owner === 'black') meta.owner = metaRaw.owner;
    if (typeof metaRaw.promotionSquare === 'string') {
      meta.promotionSquare = metaRaw.promotionSquare;
    }
    if (Array.isArray(metaRaw.path)) {
      const path = metaRaw.path.map((n) => {
        if (typeof n !== 'number' || !Number.isInteger(n)) {
          throw new StackingSerializerCorruptionError(
            config.gameId,
            `moveHistory[${String(index)}].meta.path entry not int`,
          );
        }
        return n;
      });
      meta.path = path;
    }
    baseMove.meta = meta;
  }
  return baseMove;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function orderedPlayableNodes(config: StackingDraughtsConfig): readonly NodeId[] {
  const all = config.boardGeometry.adjacency.listAllNodes();
  return [...all].sort((a, b) => (a as unknown as number) - (b as unknown as number));
}
