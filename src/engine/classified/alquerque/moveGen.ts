/**
 * Alquerque-engine move generator (Phase 4 Task 29.3).
 *
 * Two public entry points:
 *  - `generateSimpleMoves(state, config)` — single-step non-capturing moves
 *    along incident lines (men forward only; Mullahs in any direction).
 *  - `generateCaptureMoves(state, config)` — jump captures along incident
 *    lines, with chain recursion and deferred victim removal.
 *
 * `computeLegalMoves(state, config)` is the legalisation entry: when any
 * captures exist, the simple-move list is dropped (capture is obligatory).
 * Capture moves are then optionally pruned to the maximum-capture set
 * (controlled by `config.maximumCaptureMandatory`).
 *
 * Determinism: every output list is sorted by `(kind, fromNodeId, toNodeId,
 * captureLen desc, captureLex)` so the AI worker and main thread enumerate
 * identically — important for Zobrist parity and replay byte-stability.
 */

import type { ClassifiedGameState, ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import { asNodeId } from '../../boardGeometry';
import type {
  AlquerqueConfig,
  AlquerqueDirection,
  AlquerqueMove,
  AlquerqueOwner,
  AlquerquePieceKind,
} from './types';

// ---------------------------------------------------------------------------
// Direction utilities
// ---------------------------------------------------------------------------

/** Mirror white-authored direction set for black: N↔S, NE↔SW, NW↔SE. E/W stay. */
function mirrorForOwner(
  dirs: readonly AlquerqueDirection[],
  owner: AlquerqueOwner,
): readonly AlquerqueDirection[] {
  if (owner === 'white') return dirs;
  return dirs.map(mirror);
}

function mirror(d: AlquerqueDirection): AlquerqueDirection {
  switch (d) {
    case 'N':
      return 'S';
    case 'S':
      return 'N';
    case 'E':
      return 'W';
    case 'W':
      return 'E';
    case 'NE':
      return 'SW';
    case 'NW':
      return 'SE';
    case 'SE':
      return 'NW';
    case 'SW':
      return 'NE';
  }
}

function isDiagonalDir(d: AlquerqueDirection): boolean {
  return d === 'NE' || d === 'NW' || d === 'SE' || d === 'SW';
}

function pieceOwnerOf(piece: ClassifiedPiece): AlquerqueOwner | null {
  return piece.owner === 'white' || piece.owner === 'black' ? piece.owner : null;
}

function pieceKindOf(piece: ClassifiedPiece): AlquerquePieceKind | null {
  return piece.kind === 'man' || piece.kind === 'mullah' ? piece.kind : null;
}

function reachesPromotionRow(
  landing: NodeId,
  owner: AlquerqueOwner,
  config: AlquerqueConfig,
): boolean {
  return Math.floor((landing as unknown as number) / config.boardSize) === config.promotionRow[owner];
}

function labelOf(node: NodeId, config: AlquerqueConfig): string {
  return config.boardGeometry.coordinateLabels.notationOf(node);
}

/**
 * Step a single intersection along a compass direction. Returns the
 * destination NodeId or null if off-board OR if no incident line of the
 * required kind connects source to destination.
 */
export function stepIncident(
  source: NodeId,
  direction: AlquerqueDirection,
  config: AlquerqueConfig,
): NodeId | null {
  const size = config.boardSize;
  const idx = source as unknown as number;
  const r = Math.floor(idx / size);
  const c = idx % size;
  let dr = 0;
  let dc = 0;
  switch (direction) {
    case 'N':
      dr = -1;
      break;
    case 'S':
      dr = 1;
      break;
    case 'E':
      dc = 1;
      break;
    case 'W':
      dc = -1;
      break;
    case 'NE':
      dr = -1;
      dc = 1;
      break;
    case 'NW':
      dr = -1;
      dc = -1;
      break;
    case 'SE':
      dr = 1;
      dc = 1;
      break;
    case 'SW':
      dr = 1;
      dc = -1;
      break;
  }
  const nr = r + dr;
  const nc = c + dc;
  if (nr < 0 || nr >= size || nc < 0 || nc >= size) return null;
  const dest = asNodeId(nr * size + nc);
  // Verify the underlying adjacency graph carries an edge of the required
  // kind between source and dest. For orthogonal directions this is always
  // true between in-bounds neighbors; for diagonal directions the
  // alternating-pattern adjacency may have stripped the edge.
  const kind = isDiagonalDir(direction) ? 'diagonal' : 'orthogonal';
  const neighbors = config.boardGeometry.adjacency.ofKind(kind, source);
  for (const n of neighbors) {
    if ((n as unknown as number) === (dest as unknown as number)) return dest;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Single-step moves
// ---------------------------------------------------------------------------

export function generateSimpleMoves(
  state: ClassifiedGameState,
  config: AlquerqueConfig,
): AlquerqueMove[] {
  const turn = (state.turn ?? 'white') as AlquerqueOwner;
  const moves: AlquerqueMove[] = [];

  for (const [nodeId, piece] of state.pieces) {
    const owner = pieceOwnerOf(piece);
    if (owner !== turn) continue;
    const kind = pieceKindOf(piece);
    if (kind === null) continue;

    if (kind === 'man') {
      const dirs = mirrorForOwner(config.menMovementDirections, owner);
      for (const dir of dirs) {
        const dest = stepIncident(nodeId, dir, config);
        if (dest === null) continue;
        if (state.pieces.has(dest)) continue;
        moves.push(buildStepMove(nodeId, dest, kind, owner, dir, config));
      }
    } else {
      // Mullah — short-range by default. Flying-Mullah variant is a future
      // expansion: walk the ray in `dir` until obstruction; emit a step per
      // empty intersection.
      const dirs = config.mullahMovementDirections;
      if (config.mullahFlying) {
        for (const dir of dirs) {
          let cur: NodeId | null = stepIncident(nodeId, dir, config);
          while (cur !== null) {
            if (state.pieces.has(cur)) break;
            moves.push(buildStepMove(nodeId, cur, kind, owner, dir, config));
            cur = stepIncident(cur, dir, config);
          }
        }
      } else {
        for (const dir of dirs) {
          const dest = stepIncident(nodeId, dir, config);
          if (dest === null) continue;
          if (state.pieces.has(dest)) continue;
          moves.push(buildStepMove(nodeId, dest, kind, owner, dir, config));
        }
      }
    }
  }

  return moves;
}

function buildStepMove(
  from: NodeId,
  to: NodeId,
  kind: AlquerquePieceKind,
  owner: AlquerqueOwner,
  direction: AlquerqueDirection,
  config: AlquerqueConfig,
): AlquerqueMove {
  const base: AlquerqueMove = {
    kind: 'step',
    from: labelOf(from, config),
    to: labelOf(to, config),
    piece: kind,
    capture: [],
    meta: {
      owner,
      path: Object.freeze([from as unknown as number, to as unknown as number]),
      directions: Object.freeze([direction]),
    },
  };
  if (kind === 'man' && reachesPromotionRow(to, owner, config)) {
    return { ...base, promotion: 'mullah' };
  }
  return base;
}

// ---------------------------------------------------------------------------
// Capture chains
// ---------------------------------------------------------------------------

interface CaptureFrame {
  readonly fromNode: NodeId;
  readonly capturedSet: ReadonlySet<NodeId>;
  readonly path: readonly NodeId[];
  readonly captured: readonly NodeId[];
  readonly directions: readonly AlquerqueDirection[];
}

export function generateCaptureMoves(
  state: ClassifiedGameState,
  config: AlquerqueConfig,
): AlquerqueMove[] {
  const turn = (state.turn ?? 'white') as AlquerqueOwner;
  const out: AlquerqueMove[] = [];
  for (const [nodeId, piece] of state.pieces) {
    const owner = pieceOwnerOf(piece);
    if (owner !== turn) continue;
    const kind = pieceKindOf(piece);
    if (kind === null) continue;
    exploreChain(state, config, nodeId, kind, owner, out);
  }
  return out;
}

function exploreChain(
  state: ClassifiedGameState,
  config: AlquerqueConfig,
  origin: NodeId,
  startKind: AlquerquePieceKind,
  owner: AlquerqueOwner,
  out: AlquerqueMove[],
): void {
  const root: CaptureFrame = {
    fromNode: origin,
    capturedSet: new Set(),
    path: Object.freeze([origin]),
    captured: Object.freeze([]),
    directions: Object.freeze([]),
  };
  walkChain(state, config, owner, startKind, origin, root, out);
}

function walkChain(
  state: ClassifiedGameState,
  config: AlquerqueConfig,
  owner: AlquerqueOwner,
  startKind: AlquerquePieceKind,
  origin: NodeId,
  frame: CaptureFrame,
  out: AlquerqueMove[],
): void {
  const legs = enumerateLegs(state, config, owner, startKind, frame, origin);
  if (legs.length === 0) {
    if (frame.captured.length > 0) {
      out.push(buildCaptureMove(owner, startKind, frame, config));
    }
    return;
  }
  for (const leg of legs) {
    const nextCaptured = new Set(frame.capturedSet);
    nextCaptured.add(leg.victim);
    const nextFrame: CaptureFrame = {
      fromNode: leg.landing,
      capturedSet: nextCaptured,
      path: Object.freeze([...frame.path, leg.landing]),
      captured: Object.freeze([...frame.captured, leg.victim]),
      directions: Object.freeze([...frame.directions, leg.direction]),
    };
    walkChain(state, config, owner, startKind, origin, nextFrame, out);
  }
}

interface CaptureLeg {
  readonly direction: AlquerqueDirection;
  readonly victim: NodeId;
  readonly landing: NodeId;
}

function enumerateLegs(
  state: ClassifiedGameState,
  config: AlquerqueConfig,
  owner: AlquerqueOwner,
  startKind: AlquerquePieceKind,
  frame: CaptureFrame,
  origin: NodeId,
): readonly CaptureLeg[] {
  // Direction set depends on the original piece kind (a man stays a man for
  // the whole chain because mid-chain promotion is disabled by default).
  const dirs =
    startKind === 'man'
      ? mirrorForOwner(config.menCaptureDirections, owner)
      : config.mullahCaptureDirections;
  const legs: CaptureLeg[] = [];

  for (const dir of dirs) {
    const victim = stepIncident(frame.fromNode, dir, config);
    if (victim === null) continue;
    if (frame.capturedSet.has(victim)) continue;
    if (victim === origin) continue;
    const victimPiece = state.pieces.get(victim);
    if (!victimPiece) continue;
    if (pieceOwnerOf(victimPiece) === owner) continue;
    const landing = stepIncident(victim, dir, config);
    if (landing === null) continue;
    if (frame.capturedSet.has(landing)) continue; // already-jumped victim sits there as blocker
    if (landing !== origin && state.pieces.has(landing)) continue;
    legs.push({ direction: dir, victim, landing });
  }
  return legs;
}

function buildCaptureMove(
  owner: AlquerqueOwner,
  startKind: AlquerquePieceKind,
  frame: CaptureFrame,
  config: AlquerqueConfig,
): AlquerqueMove {
  const fromId = frame.path[0] as NodeId;
  const toId = frame.path[frame.path.length - 1] as NodeId;
  const captureLabels = frame.captured.map((n) => labelOf(n, config));

  const promoted =
    startKind === 'man' && reachesPromotionRow(toId, owner, config);

  const meta: AlquerqueMove['meta'] = {
    owner,
    path: Object.freeze(frame.path.map((n) => n as unknown as number)),
    directions: Object.freeze([...frame.directions]),
  };

  const move: AlquerqueMove = {
    kind: 'capture',
    from: labelOf(fromId, config),
    to: labelOf(toId, config),
    piece: startKind,
    capture: captureLabels,
    meta,
    ...(promoted ? { promotion: 'mullah' as const } : {}),
  };
  return move;
}

// ---------------------------------------------------------------------------
// Max-mandatory pruning
// ---------------------------------------------------------------------------

export function filterMaximumCapture(
  candidates: readonly AlquerqueMove[],
  config: AlquerqueConfig,
): readonly AlquerqueMove[] {
  if (!config.maximumCaptureMandatory) return candidates;
  if (candidates.length === 0) return candidates;
  let max = -1;
  for (const m of candidates) {
    if (m.capture.length > max) max = m.capture.length;
  }
  return candidates.filter((m) => m.capture.length === max);
}

// ---------------------------------------------------------------------------
// Top-level legal-move composer
// ---------------------------------------------------------------------------

export function computeLegalMoves(
  state: ClassifiedGameState,
  config: AlquerqueConfig,
): readonly AlquerqueMove[] {
  const captures = generateCaptureMoves(state, config);
  const filteredCaptures = filterMaximumCapture(captures, config);
  if (filteredCaptures.length > 0) {
    return sortMoves(filteredCaptures);
  }
  const simple = generateSimpleMoves(state, config);
  return sortMoves(simple);
}

function sortMoves(moves: readonly AlquerqueMove[]): readonly AlquerqueMove[] {
  const copy = [...moves];
  copy.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    if (a.to !== b.to) return a.to < b.to ? -1 : 1;
    if (a.capture.length !== b.capture.length) return b.capture.length - a.capture.length;
    const al = a.capture.join(',');
    const bl = b.capture.join(',');
    return al < bl ? -1 : al > bl ? 1 : 0;
  });
  return copy;
}
