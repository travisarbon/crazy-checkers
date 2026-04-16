/**
 * Tier 1 draughts move generator (Task 28.2).
 *
 * Two public entry points: `generateSimpleMoves(state, config)` enumerates
 * every non-capturing legal step for the active player, and
 * `generateJumpSequences(state, config)` enumerates every legal capture
 * chain. Together they form the candidate set that `getLegalMoves` consults
 * (before capture-obligation / maximum-capture / priority filtering).
 *
 * Every branch reads a `DraughtsConfig` field — no `gameId` comparisons are
 * performed here (enforced by diff review; see plan §13.1). The module is
 * pure: `state` is never mutated, and no RNG or ambient state is consulted.
 */

import type { NodeId } from '../../boardGeometry';
import { asNodeId } from '../../boardGeometry';
import type { ClassifiedGameState, ClassifiedPiece } from '../state';
import type { ClassifiedMove } from '../ClassifiedRuleSet';
import type {
  CapturedPieceRemovalTiming,
  DraughtsConfig,
  DraughtsDirection,
  KingType,
} from './DraughtsConfig';
import { boardSizeOf, DIAGONAL_DIRECTIONS } from './DraughtsConfig';

// ---------------------------------------------------------------------------
// Move shape — specialises ClassifiedMove's optional fields with Tier 1 rules.
// ---------------------------------------------------------------------------

export type Owner = 'white' | 'black';
export type PieceKind = 'man' | 'king';

export interface DraughtsMove extends ClassifiedMove {
  readonly kind: 'simple' | 'jump';
  readonly from: string;
  readonly to: string;
  readonly piece: PieceKind;
  readonly promotion?: 'king';
  readonly capture: readonly string[];
  readonly meta?: {
    readonly capturedNodesInFlight?: readonly string[];
    readonly promotionSquare?: string;
    readonly owner?: Owner;
  };
}

// ---------------------------------------------------------------------------
// JumpTreeNode — the recursive capture-chain exploration result.
// ---------------------------------------------------------------------------

export interface JumpTreeNode {
  readonly path: readonly NodeId[];
  readonly captured: readonly NodeId[];
  readonly pieceKind: PieceKind;
  readonly children: readonly JumpTreeNode[];
  readonly promotionLeg?: number;
}

// ---------------------------------------------------------------------------
// Direction math
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

const DIAGONAL_SET: ReadonlySet<DraughtsDirection> = new Set(DIAGONAL_DIRECTIONS);

function isDiagonal(dir: DraughtsDirection): boolean {
  return DIAGONAL_SET.has(dir);
}

/** 180° reflection — used to map white-authored direction arrays to black. */
const REFLECT: Record<DraughtsDirection, DraughtsDirection> = {
  n: 's',
  s: 'n',
  e: 'w',
  w: 'e',
  nw: 'se',
  ne: 'sw',
  sw: 'ne',
  se: 'nw',
};

export function reflectForOwner(
  dirs: readonly DraughtsDirection[],
  owner: Owner,
): readonly DraughtsDirection[] {
  if (owner === 'white') return dirs;
  return dirs.map((d) => REFLECT[d]);
}

function stepNode(
  id: NodeId,
  dir: DraughtsDirection,
  size: number,
  darkOnly: boolean,
): NodeId | null {
  const n = id as unknown as number;
  const r = Math.floor(n / size);
  const c = n % size;
  const [dr, dc] = DELTA[dir];
  // On dark-only boards, orthogonal steps must skip the intervening light
  // square: a2→a4 (col +2) rather than a2→a3 (col +1, which isn't playable).
  // Diagonal steps always preserve the (r+c) parity so a single +1 works.
  const mult = darkOnly && !isDiagonal(dir) ? 2 : 1;
  const nr = r + dr * mult;
  const nc = c + dc * mult;
  if (nr < 0 || nr >= size || nc < 0 || nc >= size) return null;
  return asNodeId(nr * size + nc);
}

function rowOf(id: NodeId, size: number): number {
  return Math.floor((id as unknown as number) / size);
}

function nodeIsPlayable(id: NodeId, size: number, darkOnly: boolean): boolean {
  if (!darkOnly) return true;
  const n = id as unknown as number;
  const r = Math.floor(n / size);
  const c = n % size;
  return (r + c) % 2 === 1;
}

// ---------------------------------------------------------------------------
// Promotion helper
// ---------------------------------------------------------------------------

/** Back row of the opponent for a mover with the given owner. */
function opponentBackRow(owner: Owner, size: number): number {
  return owner === 'white' ? 0 : size - 1;
}

function reachesBackRow(landing: NodeId, owner: Owner, size: number): boolean {
  return rowOf(landing, size) === opponentBackRow(owner, size);
}

// ---------------------------------------------------------------------------
// Labeling: NodeId ↔ string
// ---------------------------------------------------------------------------

function labelOf(id: NodeId, config: DraughtsConfig): string {
  return config.boardGeometry.coordinateLabels.notationOf(id);
}

// ---------------------------------------------------------------------------
// Simple-move generator
// ---------------------------------------------------------------------------

export function generateSimpleMoves(
  state: ClassifiedGameState,
  config: DraughtsConfig,
): DraughtsMove[] {
  const turn = (state.turn ?? 'white') as Owner;
  const size = boardSizeOf(config);
  const darkOnly = config.boardGeometry.playableMask !== undefined;
  const moves: DraughtsMove[] = [];

  for (const [nodeId, piece] of state.pieces) {
    if (piece.owner !== turn) continue;
    const kind = piece.kind as PieceKind;
    const dirsAuthored =
      kind === 'man' ? config.menMoveDirections : config.kingMoveDirections;
    const dirs = reflectForOwner(dirsAuthored, turn);
    const flying = kind === 'king' && config.kingType === 'flying';
    for (const dir of dirs) {
      let cur = stepNode(nodeId, dir, size, darkOnly);
      while (cur !== null) {
        if (!nodeIsPlayable(cur, size, darkOnly)) break;
        if (state.pieces.has(cur)) break;
        moves.push(
          buildSimpleMove(nodeId, cur, kind, turn, config, size),
        );
        if (!flying) break;
        cur = stepNode(cur, dir, size, darkOnly);
      }
    }
  }

  return moves;
}

function buildSimpleMove(
  from: NodeId,
  to: NodeId,
  piece: PieceKind,
  owner: Owner,
  config: DraughtsConfig,
  size: number,
): DraughtsMove {
  const base: DraughtsMove = {
    kind: 'simple',
    from: labelOf(from, config),
    to: labelOf(to, config),
    piece,
    capture: [],
    meta: { owner },
  };
  if (piece === 'man' && reachesBackRow(to, owner, size)) {
    return { ...base, promotion: 'king' };
  }
  return base;
}

// ---------------------------------------------------------------------------
// Jump-sequence exploration
// ---------------------------------------------------------------------------

interface JumpContext {
  readonly state: ClassifiedGameState;
  readonly config: DraughtsConfig;
  readonly size: 8 | 10 | 12;
  readonly darkOnly: boolean;
  readonly owner: Owner;
  readonly originalFrom: NodeId;
  readonly kingType: KingType;
  readonly timing: CapturedPieceRemovalTiming;
}

interface Frame {
  readonly fromNode: NodeId;
  readonly pieceKind: PieceKind;
  readonly capturedSet: ReadonlySet<NodeId>;
  readonly workingPieces: ReadonlyMap<NodeId, ClassifiedPiece>;
  readonly legIndex: number;
  readonly promotionLeg: number | undefined;
  readonly path: readonly NodeId[];
  readonly captured: readonly NodeId[];
}

export function exploreJumps(
  state: ClassifiedGameState,
  config: DraughtsConfig,
  fromNode: NodeId,
  piece: ClassifiedPiece,
): JumpTreeNode {
  const owner = piece.owner as Owner;
  const size = boardSizeOf(config);
  const ctx: JumpContext = {
    state,
    config,
    size,
    darkOnly: config.boardGeometry.playableMask !== undefined,
    owner,
    originalFrom: fromNode,
    kingType: config.kingType,
    timing: config.capturedPieceRemovalTiming,
  };

  // Remove the mover from the working piece map for occupancy checks.
  const initialWorking = new Map(state.pieces);
  initialWorking.delete(fromNode);

  const root: Frame = {
    fromNode,
    pieceKind: piece.kind as PieceKind,
    capturedSet: new Set(),
    workingPieces: initialWorking,
    legIndex: 0,
    promotionLeg: undefined,
    path: [fromNode],
    captured: [],
  };

  return extendFrame(ctx, root);
}

function extendFrame(ctx: JumpContext, frame: Frame): JumpTreeNode {
  const children: JumpTreeNode[] = [];
  const legs = enumerateLegs(ctx, frame);
  for (const leg of legs) {
    const nextFrame = applyLeg(ctx, frame, leg);
    children.push(extendFrame(ctx, nextFrame));
  }
  return {
    path: frame.path,
    captured: frame.captured,
    pieceKind: frame.pieceKind,
    children,
    ...(frame.promotionLeg !== undefined ? { promotionLeg: frame.promotionLeg } : {}),
  };
}

interface Leg {
  readonly dir: DraughtsDirection;
  readonly victim: NodeId;
  readonly landing: NodeId;
}

function enumerateLegs(ctx: JumpContext, frame: Frame): readonly Leg[] {
  const { config } = ctx;
  const dirsAuthored =
    frame.pieceKind === 'man'
      ? config.menCaptureDirections
      : config.kingCaptureDirections;
  const dirs = reflectForOwner(dirsAuthored, ctx.owner);
  const isFlying = frame.pieceKind === 'king' && ctx.kingType === 'flying';
  const legs: Leg[] = [];

  for (const dir of dirs) {
    const found = isFlying
      ? scanFlyingVictim(ctx, frame, dir)
      : scanShortVictim(ctx, frame, dir);
    if (!found) continue;

    const { victim } = found;
    const orthoLimited =
      config.kingOrthogonalCaptureIsLimited &&
      frame.pieceKind === 'king' &&
      !isDiagonal(dir);

    // Enumerate landing candidates along the ray past the victim.
    const landingsFlyingLike = isFlying && !orthoLimited;
    let landing = stepNode(victim, dir, ctx.size, ctx.darkOnly);
    while (landing !== null) {
      if (!nodeIsPlayable(landing, ctx.size, ctx.darkOnly)) break;
      // A landing node is valid iff it's empty in workingPieces OR it is the
      // original start square (the mover vacated it) OR it is the mover's
      // current fromNode (same reason, when the chain returns to start via
      // a different path). The `originalFrom` membership is the reason the
      // mover was removed from `workingPieces` in `exploreJumps`.
      const occupied = ctx.state.pieces.has(landing);
      const removed = ctx.timing === 'immediate' && frame.capturedSet.has(landing);
      const freeByTiming = !occupied || removed;
      const isStartSquare = landing === ctx.originalFrom;
      if (!freeByTiming && !isStartSquare) break;

      legs.push({ dir, victim, landing });
      if (!landingsFlyingLike) break;
      landing = stepNode(landing, dir, ctx.size, ctx.darkOnly);
    }
  }

  return legs;
}

function scanShortVictim(
  ctx: JumpContext,
  frame: Frame,
  dir: DraughtsDirection,
): { victim: NodeId } | null {
  const victimId = stepNode(frame.fromNode, dir, ctx.size, ctx.darkOnly);
  if (victimId === null) return null;
  if (!nodeIsPlayable(victimId, ctx.size, ctx.darkOnly)) return null;
  return validateVictim(ctx, frame, victimId);
}

function scanFlyingVictim(
  ctx: JumpContext,
  frame: Frame,
  dir: DraughtsDirection,
): { victim: NodeId } | null {
  let cur = stepNode(frame.fromNode, dir, ctx.size, ctx.darkOnly);
  while (cur !== null) {
    if (!nodeIsPlayable(cur, ctx.size, ctx.darkOnly)) return null;
    const occupied = ctx.state.pieces.has(cur);
    const removed = ctx.timing === 'immediate' && frame.capturedSet.has(cur);
    if (occupied && !removed) {
      return validateVictim(ctx, frame, cur);
    }
    cur = stepNode(cur, dir, ctx.size, ctx.darkOnly);
  }
  return null;
}

function validateVictim(
  ctx: JumpContext,
  frame: Frame,
  victimId: NodeId,
): { victim: NodeId } | null {
  if (frame.capturedSet.has(victimId)) return null;
  const victim = ctx.state.pieces.get(victimId);
  if (!victim) return null;
  if (victim.owner === ctx.owner) return null;
  if (!ctx.config.menCanCaptureKings && frame.pieceKind === 'man' && victim.kind === 'king') {
    return null;
  }
  return { victim: victimId };
}

function applyLeg(ctx: JumpContext, frame: Frame, leg: Leg): Frame {
  const { victim, landing } = leg;
  const newCapturedSet = new Set(frame.capturedSet);
  newCapturedSet.add(victim);
  const newWorking =
    ctx.timing === 'immediate'
      ? removeFromMap(frame.workingPieces, victim)
      : frame.workingPieces;

  let nextKind = frame.pieceKind;
  let nextPromotionLeg = frame.promotionLeg;
  if (
    frame.pieceKind === 'man' &&
    reachesBackRow(landing, ctx.owner, ctx.size) &&
    ctx.config.promotionBehavior === 'mid-capture'
  ) {
    nextKind = 'king';
    if (nextPromotionLeg === undefined) nextPromotionLeg = frame.legIndex;
  }

  return {
    fromNode: landing,
    pieceKind: nextKind,
    capturedSet: newCapturedSet,
    workingPieces: newWorking,
    legIndex: frame.legIndex + 1,
    promotionLeg: nextPromotionLeg,
    path: [...frame.path, landing],
    captured: [...frame.captured, victim],
  };
}

function removeFromMap(
  map: ReadonlyMap<NodeId, ClassifiedPiece>,
  key: NodeId,
): ReadonlyMap<NodeId, ClassifiedPiece> {
  const out = new Map(map);
  out.delete(key);
  return out;
}

// ---------------------------------------------------------------------------
// Jump-tree flattening
// ---------------------------------------------------------------------------

export function flattenJumpTree(
  root: JumpTreeNode,
  owner: Owner,
  config: DraughtsConfig,
  startKind: PieceKind,
): DraughtsMove[] {
  const moves: DraughtsMove[] = [];
  const size = boardSizeOf(config);
  emitLeaves(root, owner, config, size, startKind, moves);
  return moves;
}

function emitLeaves(
  node: JumpTreeNode,
  owner: Owner,
  config: DraughtsConfig,
  size: number,
  startKind: PieceKind,
  out: DraughtsMove[],
): void {
  if (node.children.length > 0) {
    // Promotion-behaviour branching (Task 28.2.1 §3):
    //   - `'standard'`     → promotion-stop: chain terminates at back-row landing.
    //   - `'mid-capture'`  → promote to king (handled in `applyLeg`); chain
    //                        continues as a king — pieceKind is already 'king'
    //                        on the frame, so this branch is skipped.
    //   - `'end-of-turn'`  → stay as man; chain continues with man rules.
    //                        Promotion fires only if the final landing is on
    //                        the back row (handled below at leaf emission).
    const shouldStopAtPromotion =
      startKind === 'man' &&
      node.pieceKind === 'man' &&
      config.promotionBehavior === 'standard' &&
      node.path.length > 1 &&
      reachesBackRow(node.path[node.path.length - 1] as NodeId, owner, size);
    if (!shouldStopAtPromotion) {
      for (const child of node.children) {
        emitLeaves(child, owner, config, size, startKind, out);
      }
      return;
    }
    // Promotion-stop → fall through and emit this node as a leaf.
  }
  if (node.path.length < 2) return; // Root with no legs is not a jump move.

  const fromId = node.path[0] as NodeId;
  const toId = node.path[node.path.length - 1] as NodeId;
  const capturedLabels = node.captured.map((n) => labelOf(n, config));
  const toLabel = labelOf(toId, config);

  // Promotion determination: `startKind` must have been 'man' to promote.
  // `node.pieceKind === 'king'` means mid-capture promotion fired at some leg.
  // Otherwise promotion fires iff the leaf landing is on opp back row.
  const promoted =
    startKind === 'man' &&
    (node.pieceKind === 'king' || reachesBackRow(toId, owner, size));

  const meta: {
    capturedNodesInFlight?: readonly string[];
    promotionSquare?: string;
    owner?: Owner;
  } = { owner };
  if (config.capturedPieceRemovalTiming === 'end-of-sequence' && capturedLabels.length > 0) {
    meta.capturedNodesInFlight = capturedLabels;
  }
  if (node.promotionLeg !== undefined) {
    const promoSquareId = node.path[node.promotionLeg + 1] as NodeId;
    meta.promotionSquare = labelOf(promoSquareId, config);
  }

  const move: DraughtsMove = {
    kind: 'jump',
    from: labelOf(fromId, config),
    to: toLabel,
    piece: startKind,
    capture: capturedLabels,
    meta,
    ...(promoted ? { promotion: 'king' as const } : {}),
  };
  out.push(move);
}

// ---------------------------------------------------------------------------
// Top-level jump enumeration
// ---------------------------------------------------------------------------

export function generateJumpSequences(
  state: ClassifiedGameState,
  config: DraughtsConfig,
): DraughtsMove[] {
  const turn = (state.turn ?? 'white') as Owner;
  const moves: DraughtsMove[] = [];
  for (const [nodeId, piece] of state.pieces) {
    if (piece.owner !== turn) continue;
    const tree = exploreJumps(state, config, nodeId, piece);
    moves.push(...flattenJumpTree(tree, turn, config, piece.kind as PieceKind));
  }
  return moves;
}

// ---------------------------------------------------------------------------
// Italian filter — men cannot capture kings.
// ---------------------------------------------------------------------------

export function filterIllegalManCapturesKing(
  candidates: readonly DraughtsMove[],
  state: ClassifiedGameState,
  config: DraughtsConfig,
): readonly DraughtsMove[] {
  if (config.menCanCaptureKings) return candidates;
  // A move is illegal iff its starting piece is a man AND, at the leg at which
  // a king victim is captured, the mover is still a man. Under `'standard'`
  // promotion (Italian's setting) the man stays a man throughout the chain,
  // so the predicate simplifies to "man-start move captures any king".
  const out: DraughtsMove[] = [];
  outer: for (const move of candidates) {
    if (move.piece !== 'man') {
      out.push(move);
      continue;
    }
    for (const capId of move.capture) {
      const captured = findCapturedPiece(state, config, capId);
      if (captured?.kind === 'king') continue outer;
    }
    out.push(move);
  }
  return out;
}

function findCapturedPiece(
  state: ClassifiedGameState,
  config: DraughtsConfig,
  label: string,
): ClassifiedPiece | undefined {
  const node = config.boardGeometry.coordinateLabels.parseNotation(label);
  if (node === null) return undefined;
  return state.pieces.get(node);
}

// ---------------------------------------------------------------------------
// Maximum capture
// ---------------------------------------------------------------------------

export function captureWeight(
  move: DraughtsMove,
  state: ClassifiedGameState,
  config: DraughtsConfig,
  useKingWeight: boolean,
): number {
  let total = 0;
  for (const label of move.capture) {
    const piece = findCapturedPiece(state, config, label);
    if (!piece) {
      total += 1;
      continue;
    }
    total += piece.kind === 'king' && useKingWeight ? 1.5 : 1;
  }
  return total;
}

export function filterMaximumCapture(
  candidates: readonly DraughtsMove[],
  state: ClassifiedGameState,
  config: DraughtsConfig,
): readonly DraughtsMove[] {
  if (candidates.length === 0) return candidates;
  if (!config.maximumCaptureMandatory) return candidates;
  const useKingWeight = config.capturePriorityRules.includes('kings-weight-1-5');
  let max = -1;
  const weights = new Map<DraughtsMove, number>();
  for (const m of candidates) {
    const w = captureWeight(m, state, config, useKingWeight);
    weights.set(m, w);
    if (w > max) max = w;
  }
  return candidates.filter((m) => weights.get(m) === max);
}
