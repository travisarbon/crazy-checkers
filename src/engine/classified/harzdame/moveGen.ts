/**
 * Harzdame move generator (Phase 4 Task 29.5).
 *
 * Two move kinds:
 *  - `'move'`: non-capturing step. Men: 2 of 4 diagonals (asymmetric).
 *    Kings: flying any distance in any of 4 diagonals.
 *  - `'capture'`: jump-to-capture chain. Men: short leap in any of 4
 *    diagonals (asymmetric move/capture). Kings: flying-leap in any of 4.
 *
 * Capture-removal semantics are **IMMEDIATE** — victims are removed from
 * the working state at each leg, before recursion continues. This differs
 * from Tier 2 siblings (29.2/29.3/29.4) which defer to chain end.
 *
 * Capture obligation is enforced (slides dropped when captures exist).
 * Maximum-capture filtering is config-gated (default OFF per Phase 4 plan).
 *
 * Determinism: every output list is sorted by `(kind, from, to,
 * capture.length descending, capture lex)`.
 */

import type { ClassifiedGameState, ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type { DraughtsDirection } from '../draughts/DraughtsConfig';
import type {
  HarzdameConfig,
  HarzdameMove,
  HarzdameOwner,
  HarzdamePieceKind,
} from './types';

// ---------------------------------------------------------------------------
// Direction primitives
// ---------------------------------------------------------------------------

const DELTA: Record<DraughtsDirection, readonly [number, number]> = {
  n: [-1, 0],
  s: [1, 0],
  e: [0, 1],
  w: [0, -1],
  nw: [-1, -1],
  ne: [-1, 1],
  sw: [1, -1],
  se: [1, 1],
};

function rowOf(node: NodeId, size: number): number {
  return Math.floor((node as unknown as number) / size);
}
function colOf(node: NodeId, size: number): number {
  return (node as unknown as number) % size;
}
function inBounds(r: number, c: number, size: number): boolean {
  return r >= 0 && r < size && c >= 0 && c < size;
}
function nodeAt(r: number, c: number, size: number): NodeId {
  return (r * size + c) as unknown as NodeId;
}
function isDarkSquare(node: NodeId, size: number): boolean {
  const r = rowOf(node, size);
  const c = colOf(node, size);
  return (r + c) % 2 === 1;
}

function pieceOwnerOf(piece: ClassifiedPiece): HarzdameOwner | null {
  return piece.owner === 'white' || piece.owner === 'black' ? piece.owner : null;
}

function pieceKindOf(piece: ClassifiedPiece): HarzdamePieceKind | null {
  return piece.kind === 'man' || piece.kind === 'king' ? piece.kind : null;
}

function labelOf(node: NodeId, config: HarzdameConfig): string {
  return config.boardGeometry.coordinateLabels.notationOf(node);
}

/**
 * Step a single dark-square in `direction`. Returns destination NodeId or
 * null if off-board / off-mask.
 */
function stepDiag(
  source: NodeId,
  direction: DraughtsDirection,
  size: number,
): NodeId | null {
  const r = rowOf(source, size);
  const c = colOf(source, size);
  const [dr, dc] = DELTA[direction];
  const nr = r + dr;
  const nc = c + dc;
  if (!inBounds(nr, nc, size)) return null;
  const dest = nodeAt(nr, nc, size);
  if (!isDarkSquare(dest, size)) return null;
  return dest;
}

// ---------------------------------------------------------------------------
// Single-step (non-capturing) moves
// ---------------------------------------------------------------------------

export function generateStepMoves(
  state: ClassifiedGameState,
  config: HarzdameConfig,
): HarzdameMove[] {
  const turn = (state.turn ?? 'white') as HarzdameOwner;
  const moves: HarzdameMove[] = [];
  const size = config.boardSize;

  for (const [nodeId, piece] of state.pieces) {
    const owner = pieceOwnerOf(piece);
    if (owner !== turn) continue;
    const kind = pieceKindOf(piece);
    if (kind === null) continue;

    if (kind === 'man') {
      const dirs = config.menMovementDirections[owner];
      for (const dir of dirs) {
        const dest = stepDiag(nodeId, dir, size);
        if (dest === null) continue;
        if (state.pieces.has(dest)) continue;
        moves.push(buildStepMove(nodeId, dest, kind, owner, dir, config));
      }
    } else {
      // Flying king: walk each of 4 diagonals until obstruction.
      for (const dir of config.kingMovementDirections) {
        let cur: NodeId | null = stepDiag(nodeId, dir, size);
        while (cur !== null) {
          if (state.pieces.has(cur)) break;
          moves.push(buildStepMove(nodeId, cur, kind, owner, dir, config));
          cur = stepDiag(cur, dir, size);
        }
      }
    }
  }

  return moves;
}

function buildStepMove(
  from: NodeId,
  to: NodeId,
  kind: HarzdamePieceKind,
  owner: HarzdameOwner,
  direction: DraughtsDirection,
  config: HarzdameConfig,
): HarzdameMove {
  const base: HarzdameMove = {
    kind: 'move',
    from: labelOf(from, config),
    to: labelOf(to, config),
    piece: kind,
    capture: [],
    meta: {
      owner,
      fromNode: from as unknown as number,
      toNode: to as unknown as number,
      path: Object.freeze([from as unknown as number, to as unknown as number]),
      directions: Object.freeze([direction]),
    },
  };
  // Promotion: man arrives on promotion-area square via NON-capture.
  if (kind === 'man' && config.promotionArea[owner].has(to)) {
    return { ...base, promotion: 'king' };
  }
  return base;
}

// ---------------------------------------------------------------------------
// Capture chain enumeration (immediate-removal semantics)
// ---------------------------------------------------------------------------

interface CaptureFrame {
  readonly fromNode: NodeId;
  /**
   * Working pieces map — DIFFERS from the input state because immediate-
   * removal mutates this view as legs commit.
   */
  readonly workingPieces: ReadonlyMap<NodeId, ClassifiedPiece>;
  readonly path: readonly NodeId[];
  readonly captured: readonly NodeId[];
  readonly directions: readonly DraughtsDirection[];
}

interface CaptureLeg {
  readonly direction: DraughtsDirection;
  readonly victim: NodeId;
  readonly landing: NodeId;
}

export function generateCaptureMoves(
  state: ClassifiedGameState,
  config: HarzdameConfig,
): HarzdameMove[] {
  const turn = (state.turn ?? 'white') as HarzdameOwner;
  const out: HarzdameMove[] = [];
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
  config: HarzdameConfig,
  origin: NodeId,
  startKind: HarzdamePieceKind,
  owner: HarzdameOwner,
  out: HarzdameMove[],
): void {
  // Working pieces: clone state.pieces. The mover lives at `origin` (we
  // leave it in the map so capture logic can see it; subsequent legs treat
  // the mover as moving to the new landing, but the immediate-removal
  // discipline cares about VICTIMS, not the mover).
  const workingPieces = new Map<NodeId, ClassifiedPiece>(state.pieces);

  const root: CaptureFrame = {
    fromNode: origin,
    workingPieces,
    path: Object.freeze([origin]),
    captured: Object.freeze([]),
    directions: Object.freeze([]),
  };
  walkChain(state, config, owner, startKind, origin, root, out);
}

function walkChain(
  state: ClassifiedGameState,
  config: HarzdameConfig,
  owner: HarzdameOwner,
  startKind: HarzdamePieceKind,
  origin: NodeId,
  frame: CaptureFrame,
  out: HarzdameMove[],
): void {
  void state;
  const legs = enumerateLegs(config, owner, startKind, frame, origin);
  if (legs.length === 0) {
    if (frame.captured.length > 0) {
      out.push(buildCaptureMove(owner, startKind, frame, config));
    }
    return;
  }
  for (const leg of legs) {
    // IMMEDIATE removal: clone the working pieces, remove the victim
    // before recursing.
    const nextWorking = new Map(frame.workingPieces);
    nextWorking.delete(leg.victim);
    // Move the mover from frame.fromNode to leg.landing in the working map.
    const moverPiece = nextWorking.get(frame.fromNode);
    if (moverPiece) {
      nextWorking.delete(frame.fromNode);
      nextWorking.set(leg.landing, moverPiece);
    }
    const nextFrame: CaptureFrame = {
      fromNode: leg.landing,
      workingPieces: nextWorking,
      path: Object.freeze([...frame.path, leg.landing]),
      captured: Object.freeze([...frame.captured, leg.victim]),
      directions: Object.freeze([...frame.directions, leg.direction]),
    };
    walkChain(state, config, owner, startKind, origin, nextFrame, out);
  }
}

function enumerateLegs(
  config: HarzdameConfig,
  owner: HarzdameOwner,
  startKind: HarzdamePieceKind,
  frame: CaptureFrame,
  origin: NodeId,
): readonly CaptureLeg[] {
  const dirs =
    startKind === 'man' ? config.menCaptureDirections : config.kingCaptureDirections;
  // config.kingType is locked to 'flying' at the type level for Harzdame.
  void config.kingType;
  const isFlying = startKind === 'king';
  const size = config.boardSize;
  const legs: CaptureLeg[] = [];

  for (const dir of dirs) {
    const found = isFlying
      ? scanFlyingVictim(frame, dir, owner, origin, size)
      : scanShortVictim(frame, dir, owner, origin, size);
    if (!found) continue;
    const { victim } = found;

    // Enumerate landings past the victim.
    if (isFlying) {
      let landing: NodeId | null = stepDiag(victim, dir, size);
      while (landing !== null) {
        const occupied = frame.workingPieces.has(landing);
        const isOrigin = landing === origin;
        if (occupied && !isOrigin) break;
        legs.push({ direction: dir, victim, landing });
        landing = stepDiag(landing, dir, size);
      }
    } else {
      const landing = stepDiag(victim, dir, size);
      if (landing === null) continue;
      const occupied = frame.workingPieces.has(landing);
      const isOrigin = landing === origin;
      if (occupied && !isOrigin) continue;
      legs.push({ direction: dir, victim, landing });
    }
  }
  return legs;
}

function scanShortVictim(
  frame: CaptureFrame,
  dir: DraughtsDirection,
  owner: HarzdameOwner,
  origin: NodeId,
  size: number,
): { victim: NodeId } | null {
  const victim = stepDiag(frame.fromNode, dir, size);
  if (victim === null) return null;
  if (victim === origin) return null;
  const piece = frame.workingPieces.get(victim);
  if (!piece) return null;
  if (pieceOwnerOf(piece) === owner) return null;
  return { victim };
}

function scanFlyingVictim(
  frame: CaptureFrame,
  dir: DraughtsDirection,
  owner: HarzdameOwner,
  origin: NodeId,
  size: number,
): { victim: NodeId } | null {
  let cur: NodeId | null = stepDiag(frame.fromNode, dir, size);
  while (cur !== null) {
    if (cur === origin) {
      // Origin is logically empty during the chain (the mover vacated it).
      cur = stepDiag(cur, dir, size);
      continue;
    }
    if (frame.workingPieces.has(cur)) {
      const piece = frame.workingPieces.get(cur);
      if (!piece) return null;
      if (pieceOwnerOf(piece) === owner) return null;
      return { victim: cur };
    }
    cur = stepDiag(cur, dir, size);
  }
  return null;
}

function buildCaptureMove(
  owner: HarzdameOwner,
  startKind: HarzdamePieceKind,
  frame: CaptureFrame,
  config: HarzdameConfig,
): HarzdameMove {
  const fromId = frame.path[0] as NodeId;
  const toId = frame.path[frame.path.length - 1] as NodeId;
  const captureLabels = frame.captured.map((n) => labelOf(n, config));

  const meta: HarzdameMove['meta'] = {
    owner,
    fromNode: fromId as unknown as number,
    toNode: toId as unknown as number,
    path: Object.freeze(frame.path.map((n) => n as unknown as number)),
    directions: Object.freeze([...frame.directions]),
  };

  // Per Harzdame: man arriving via capture on promotion-area DOES NOT promote.
  // Promotion is denied on capture-arrival (config.promotionDeniedOnCaptureArrival).
  // Senior-king flip is computed in applyMove (it depends on the position-max
  // chain length across all pieces, not just this piece's chain).
  return {
    kind: 'capture',
    from: labelOf(fromId, config),
    to: labelOf(toId, config),
    piece: startKind,
    capture: captureLabels,
    meta,
  };
}

// ---------------------------------------------------------------------------
// Max-capture pruning
// ---------------------------------------------------------------------------

export function filterMaximumCapture(
  candidates: readonly HarzdameMove[],
  config: HarzdameConfig,
): readonly HarzdameMove[] {
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
  config: HarzdameConfig,
): readonly HarzdameMove[] {
  const captures = generateCaptureMoves(state, config);
  const filteredCaptures = filterMaximumCapture(captures, config);
  if (filteredCaptures.length > 0) {
    return sortMoves(filteredCaptures);
  }
  const steps = generateStepMoves(state, config);
  return sortMoves(steps);
}

function sortMoves(moves: readonly HarzdameMove[]): readonly HarzdameMove[] {
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

/** Compute the maximum capture-chain length available in `state` for the active side. Used by `applyMove` for senior-king flips. */
export function maxCaptureChainLength(
  state: ClassifiedGameState,
  config: HarzdameConfig,
): number {
  const captures = generateCaptureMoves(state, config);
  let max = 0;
  for (const m of captures) {
    if (m.capture.length > max) max = m.capture.length;
  }
  return max;
}
