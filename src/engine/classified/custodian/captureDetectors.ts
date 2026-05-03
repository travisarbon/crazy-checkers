/**
 * Custodian capture detectors (Phase 4 Task 29.4).
 *
 * Five pure functions implementing the playbook §3.3 method signatures.
 * Each detector takes a post-move state and returns the sorted list of
 * NodeIds that the just-completed move captures via that mode.
 *
 * Detectors are mode-specific and pure; the engine's `applyMove` invokes
 * them in the canonical order documented in `RULES_NOTES.md`:
 *   custodian → intervention → corner → line → immobilization.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type { CustodianConfig, CustodianOwner } from './types';
import { findConnectedComponents } from './connectedComponents';

// ---------------------------------------------------------------------------
// Direction primitives
// ---------------------------------------------------------------------------

const ORTHO_DELTAS: ReadonlyArray<readonly [number, number]> = Object.freeze([
  [-1, 0], // N (toward row 0)
  [1, 0], // S
  [0, -1], // W
  [0, 1], // E
]);

const OPPOSING_PAIRS: ReadonlyArray<readonly [number, number]> = Object.freeze([
  [0, 1], // N + S
  [2, 3], // W + E
]);

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

function isOpponent(piece: ClassifiedPiece | undefined, owner: CustodianOwner): boolean {
  if (!piece) return false;
  return piece.owner !== owner && (piece.owner === 'white' || piece.owner === 'black');
}

function isFriendly(piece: ClassifiedPiece | undefined, owner: CustodianOwner): boolean {
  if (!piece) return false;
  return piece.owner === owner;
}

// ---------------------------------------------------------------------------
// 5.1 Custodian capture
// ---------------------------------------------------------------------------

export function findCustodianCaptures(
  pieces: ReadonlyMap<NodeId, ClassifiedPiece>,
  landingNode: NodeId,
  owner: CustodianOwner,
  config: CustodianConfig,
): readonly NodeId[] {
  const captures = new Set<number>();
  const size = config.boardSize;
  const r = rowOf(landingNode, size);
  const c = colOf(landingNode, size);

  if (config.capture.lineCapture === 'whole-line') {
    // Aggressive Mak-yek interpretation: capture every contiguous opponent piece
    // between the landing and a friendly along each direction.
    for (const [dr, dc] of ORTHO_DELTAS) {
      const direction: NodeId[] = [];
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc, size)) {
        const cur = nodeAt(nr, nc, size);
        const piece = pieces.get(cur);
        if (!piece) break; // empty interrupts the line
        if (isOpponent(piece, owner)) {
          direction.push(cur);
        } else {
          // friendly: capture the whole accumulated opponent line
          for (const v of direction) captures.add(v as unknown as number);
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  } else {
    // Default (single-piece) custodian: ABA pattern only.
    for (const [dr, dc] of ORTHO_DELTAS) {
      const ar = r + dr;
      const ac = c + dc;
      if (!inBounds(ar, ac, size)) continue;
      const adjacent = nodeAt(ar, ac, size);
      const adjacentPiece = pieces.get(adjacent);
      if (!isOpponent(adjacentPiece, owner)) continue;
      const fr = ar + dr;
      const fc = ac + dc;
      if (!inBounds(fr, fc, size)) continue;
      const beyond = nodeAt(fr, fc, size);
      if (!isFriendly(pieces.get(beyond), owner)) continue;
      captures.add(adjacent as unknown as number);
    }
  }

  return [...captures].sort((a, b) => a - b).map((n) => n as unknown as NodeId);
}

// ---------------------------------------------------------------------------
// 5.2 Intervention capture
// ---------------------------------------------------------------------------

export function findInterventionCaptures(
  pieces: ReadonlyMap<NodeId, ClassifiedPiece>,
  landingNode: NodeId,
  owner: CustodianOwner,
  config: CustodianConfig,
): readonly NodeId[] {
  const captures = new Set<number>();
  const size = config.boardSize;
  const r = rowOf(landingNode, size);
  const c = colOf(landingNode, size);

  for (const [dirA, dirB] of OPPOSING_PAIRS) {
    const [drA, dcA] = ORTHO_DELTAS[dirA] as readonly [number, number];
    const [drB, dcB] = ORTHO_DELTAS[dirB] as readonly [number, number];
    const arA = r + drA;
    const acA = c + dcA;
    const arB = r + drB;
    const acB = c + dcB;
    if (!inBounds(arA, acA, size) || !inBounds(arB, acB, size)) continue;
    const aNode = nodeAt(arA, acA, size);
    const bNode = nodeAt(arB, acB, size);
    if (!isOpponent(pieces.get(aNode), owner)) continue;
    if (!isOpponent(pieces.get(bNode), owner)) continue;
    captures.add(aNode as unknown as number);
    captures.add(bNode as unknown as number);
  }

  return [...captures].sort((a, b) => a - b).map((n) => n as unknown as NodeId);
}

// ---------------------------------------------------------------------------
// 5.3 Corner capture
// ---------------------------------------------------------------------------

export function findCornerCaptures(
  pieces: ReadonlyMap<NodeId, ClassifiedPiece>,
  owner: CustodianOwner,
  config: CustodianConfig,
): readonly NodeId[] {
  const captures = new Set<number>();
  const size = config.boardSize;
  const corners: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [0, size - 1],
    [size - 1, 0],
    [size - 1, size - 1],
  ];
  for (const [r, c] of corners) {
    const cornerNode = nodeAt(r, c, size);
    const cornerPiece = pieces.get(cornerNode);
    if (!isOpponent(cornerPiece, owner)) continue;
    // Identify the two orthogonal neighbors of this corner.
    const neighbors: NodeId[] = [];
    if (r === 0) neighbors.push(nodeAt(1, c, size));
    if (r === size - 1) neighbors.push(nodeAt(size - 2, c, size));
    if (c === 0) neighbors.push(nodeAt(r, 1, size));
    if (c === size - 1) neighbors.push(nodeAt(r, size - 2, size));
    if (neighbors.length !== 2) continue; // shouldn't happen for canonical corners
    const allFriendly = neighbors.every((n) => isFriendly(pieces.get(n), owner));
    if (allFriendly) captures.add(cornerNode as unknown as number);
  }
  return [...captures].sort((a, b) => a - b).map((n) => n as unknown as NodeId);
}

// ---------------------------------------------------------------------------
// 5.4 Immobilization capture
// ---------------------------------------------------------------------------

/**
 * Returns the list of opponent pieces (against `actingSide`) that have no
 * legal exit moves — either per-piece (`immobilizationScope: 'piece'`) or
 * per-connected-component (`immobilizationScope: 'group'`).
 *
 * "Exit move" = a rook-style slide that lands on an empty square outside
 * the immobilized component.
 */
export function findImmobilizationCaptures(
  pieces: ReadonlyMap<NodeId, ClassifiedPiece>,
  actingSide: CustodianOwner,
  config: CustodianConfig,
): readonly NodeId[] {
  const opponent: CustodianOwner = actingSide === 'white' ? 'black' : 'white';
  const captures = new Set<number>();
  const size = config.boardSize;

  if (config.capture.immobilizationScope === 'piece') {
    for (const [nodeId, piece] of pieces) {
      if (piece.owner !== opponent) continue;
      if (!hasAnyExit(pieces, nodeId, size, /*ignoreInternal=*/ new Set([nodeId as unknown as number]))) {
        captures.add(nodeId as unknown as number);
      }
    }
  } else {
    const components = findConnectedComponents(pieces, opponent, size);
    for (const comp of components) {
      const internal = new Set(comp.nodes.map((n) => n as unknown as number));
      let anyExit = false;
      for (const node of comp.nodes) {
        if (hasAnyExit(pieces, node, size, internal)) {
          anyExit = true;
          break;
        }
      }
      if (!anyExit) {
        for (const node of comp.nodes) captures.add(node as unknown as number);
      }
    }
  }

  return [...captures].sort((a, b) => a - b).map((n) => n as unknown as NodeId);
}

/**
 * `hasAnyExit` — true iff `node` has at least one rook-style slide
 * destination that is empty AND not in `internal` (the set of NodeIds
 * considered "blocked from within" — for group-aware immobilization, this
 * is the entire component).
 */
function hasAnyExit(
  pieces: ReadonlyMap<NodeId, ClassifiedPiece>,
  node: NodeId,
  size: number,
  internal: ReadonlySet<number>,
): boolean {
  const r = rowOf(node, size);
  const c = colOf(node, size);
  for (const [dr, dc] of ORTHO_DELTAS) {
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc, size)) {
      const candidate = nodeAt(nr, nc, size);
      const idx = candidate as unknown as number;
      if (pieces.has(candidate)) {
        // Any piece (friend or enemy) blocks the ray.
        // For group-aware immobilization, friendly pieces in the same
        // component still block — that's intended (they don't free the
        // group; only an empty exit square does).
        break;
      }
      // Empty square — but if it's marked "internal" (it would be inside
      // the component's bounding region — for group scope this means part
      // of the component, but only friendly pieces can be in the component,
      // so this branch is a no-op for the typical case).
      if (!internal.has(idx)) return true;
      nr += dr;
      nc += dc;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 5.5 Line capture (alias for the whole-line custodian branch)
// ---------------------------------------------------------------------------

export function findLineCaptures(
  pieces: ReadonlyMap<NodeId, ClassifiedPiece>,
  landingNode: NodeId,
  owner: CustodianOwner,
  config: CustodianConfig,
): readonly NodeId[] {
  // Implemented inside findCustodianCaptures when lineCapture === 'whole-line'.
  // Exposed as a separate symbol for unit-testability.
  if (config.capture.lineCapture !== 'whole-line') return [];
  return findCustodianCaptures(pieces, landingNode, owner, config);
}
