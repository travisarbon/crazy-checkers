/**
 * BoardGeometry descriptor (Task 27.2, Phase 4).
 *
 * First-class, engine-layer descriptor consumed by Phase 4 renderers, rule
 * engines, notation adapters, AI search, Cogitate adapters, serializers, and
 * persistence. A single descriptor shape covers every topology in Tiers 1–7.
 *
 * See src/engine/classified/BOARD_GEOMETRY.md for authoring rules and the
 * stable serialized-key registry.
 */

import { buildSquareAdjacency, darkSquaresOnly } from './adjacency/SquareAdjacency';
import { buildRectangleAdjacency } from './adjacency/RectangleAdjacency';
import {
  buildHexRhombusAdjacency,
  buildHexTriangularAdjacency,
} from './adjacency/HexAdjacency';
import { buildRingAdjacency } from './adjacency/RingAdjacency';
import { buildCrossAdjacency } from './adjacency/CrossAdjacency';
import { buildArcTrackAdjacency } from './adjacency/ArcTrackAdjacency';
import { buildDotAdjacency } from './adjacency/DotAdjacency';
import { buildMancalaPitAdjacency } from './adjacency/MancalaPitAdjacency';
import { buildTerrainOverlayAdjacency } from './adjacency/TerrainOverlayAdjacency';
import {
  type AlquerqueDiagonalPattern,
  buildAlquerqueAdjacency,
} from './adjacency/AlquerqueAdjacency';
import { buildSquareCoordinates } from './coordinates/SquareCoordinates';
import { buildRectangleCoordinates } from './coordinates/RectangleCoordinates';
import {
  buildHexRhombusCoordinates,
  buildHexTriangularCoordinates,
} from './coordinates/HexCoordinates';
import { buildRingCoordinates } from './coordinates/RingCoordinates';
import { buildCrossCoordinates } from './coordinates/CrossCoordinates';
import { buildArcTrackCoordinates } from './coordinates/ArcTrackCoordinates';
import { buildDotCoordinates } from './coordinates/DotCoordinates';
import { buildMancalaPitCoordinates } from './coordinates/MancalaPitCoordinates';
import { buildAlquerqueCoordinates } from './coordinates/AlquerqueCoordinates';

export type NodeId = number & { readonly __brand: 'GeometryNodeId' };

export const asNodeId = (n: number): NodeId => n as NodeId;

export type BoardGeometryKind =
  | 'square'
  | 'rectangle'
  | 'hex-rhombus'
  | 'hex-triangular'
  | 'ring'
  | 'cross'
  | 'arc-track'
  | 'dot-grid'
  | 'mancala-pit'
  | 'terrain-overlay'
  | 'alquerque'
  | 'irregular-registered';

export type IndexingMode = 'squares' | 'intersections' | 'points' | 'pits' | 'dots';

export type DirectionKind =
  | 'orthogonal'
  | 'diagonal'
  | 'queen-line'
  | 'hex'
  | 'ring-spoke'
  | 'ring-around'
  | 'cross-arm'
  | 'arc-loop'
  | 'pit-chain'
  | 'dot-edge'
  | 'box-neighbor';

export type Predicate = (node: NodeId) => boolean;

export interface OverlayRegion {
  readonly name: string;
  readonly nodes: readonly NodeId[];
}

export interface Dimensions {
  readonly square?: { size: number };
  readonly rectangle?: { width: number; height: number };
  readonly hexRhombus?: { size: number };
  readonly hexTriangular?: { size: 5 | 6 | 8 };
  readonly ring?: {
    ringCount: number;
    pointsPerRing: number;
    spokes: readonly number[];
    hasCornerDiagonals: boolean;
  };
  readonly cross?: { armLength: number; hubSize: number };
  readonly arcTrack?: { innerSize: number; loopsPerCorner: number };
  readonly dotGrid?: { boxesAcross: number; boxesDown: number };
  readonly mancalaPit?: {
    rows: number;
    cols: number;
    stores: readonly ('north' | 'south')[];
    sowingOrder: readonly NodeId[];
  };
  readonly terrainOverlay?: { baseKey: string; overlays: readonly OverlayRegion[] };
  readonly alquerque?: { size: number; diagonalPattern: AlquerqueDiagonalPattern };
  readonly irregular?: { description: string };
}

export interface AdjacencyGraph {
  readonly directionKinds: readonly DirectionKind[];
  ofKind(kind: DirectionKind, node: NodeId): readonly NodeId[];
  listAllNodes(): readonly NodeId[];
  hasNode(id: NodeId): boolean;
  nodeCount(): number;
}

export interface CoordinateLabeler {
  ariaOf(node: NodeId): string;
  notationOf(node: NodeId): string;
  displayOf(node: NodeId): string;
  parseNotation(token: string): NodeId | null;
}

export interface BoardGeometry {
  readonly kind: BoardGeometryKind;
  readonly dimensions: Dimensions;
  readonly indexing: IndexingMode;
  readonly adjacency: AdjacencyGraph;
  readonly coordinateLabels: CoordinateLabeler;
  readonly serializedKey: string;
  readonly playableMask?: Predicate;
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

export interface SquareGeometryOptions {
  size: number;
  indexing: 'squares' | 'intersections';
  playableMask?: Predicate;
  variant?: 'standard' | 'pdn-8' | 'pdn-10' | 'pdn-12';
}

export function squareGeometry(opts: SquareGeometryOptions): BoardGeometry {
  const { size, indexing, playableMask, variant } = opts;
  const adjacency = buildSquareAdjacency({ size, playableMask });
  const coordinateLabels = buildSquareCoordinates({ size, indexing, playableMask, variant });
  const keyParts = [`square-${String(size)}x${String(size)}`];
  if (indexing === 'intersections') keyParts.push('inter');
  if (playableMask) keyParts.push('dark');
  return {
    kind: 'square',
    dimensions: { square: { size } },
    indexing,
    adjacency,
    coordinateLabels,
    serializedKey: keyParts.join('-'),
    playableMask,
  };
}

export interface RectangleGeometryOptions {
  width: number;
  height: number;
  indexing: IndexingMode;
  diagonalsMask?: Predicate;
  variant?: string;
}

export function rectangleGeometry(opts: RectangleGeometryOptions): BoardGeometry {
  const { width, height, indexing, diagonalsMask, variant } = opts;
  const adjacency = buildRectangleAdjacency({ width, height, diagonalsMask });
  const coordinateLabels = buildRectangleCoordinates({ width, height, indexing, variant });
  return {
    kind: 'rectangle',
    dimensions: { rectangle: { width, height } },
    indexing,
    adjacency,
    coordinateLabels,
    serializedKey: `rectangle-${String(width)}x${String(height)}-${indexing}`,
  };
}

export function hexRhombusGeometry(size: number): BoardGeometry {
  return {
    kind: 'hex-rhombus',
    dimensions: { hexRhombus: { size } },
    indexing: 'intersections',
    adjacency: buildHexRhombusAdjacency(size),
    coordinateLabels: buildHexRhombusCoordinates(size),
    serializedKey: `hex-rhombus-${String(size)}`,
  };
}

export function hexTriangularGeometry(size: 5 | 6 | 8): BoardGeometry {
  return {
    kind: 'hex-triangular',
    dimensions: { hexTriangular: { size } },
    indexing: 'intersections',
    adjacency: buildHexTriangularAdjacency(size),
    coordinateLabels: buildHexTriangularCoordinates(size),
    serializedKey: `hex-triangular-${String(size)}`,
  };
}

export type RingPreset = 'nmm' | 'morabaraba';

export function ringGeometry(preset: RingPreset): BoardGeometry {
  const hasCornerDiagonals = preset === 'morabaraba';
  const adjacency = buildRingAdjacency({ hasCornerDiagonals });
  const coordinateLabels = buildRingCoordinates();
  return {
    kind: 'ring',
    dimensions: {
      ring: {
        ringCount: 3,
        pointsPerRing: 8,
        spokes: [0, 2, 4, 6],
        hasCornerDiagonals,
      },
    },
    indexing: 'points',
    adjacency,
    coordinateLabels,
    serializedKey: `ring-${preset}`,
  };
}

export type CrossPreset = 'fox-and-geese';

export function crossGeometry(preset: CrossPreset): BoardGeometry {
  return {
    kind: 'cross',
    dimensions: { cross: { armLength: 3, hubSize: 3 } },
    indexing: 'points',
    adjacency: buildCrossAdjacency({ includeDiagonals: true }),
    coordinateLabels: buildCrossCoordinates(),
    serializedKey: `cross-${preset}`,
  };
}

export type ArcTrackPreset = 'surakarta';

export function arcTrackGeometry(preset: ArcTrackPreset): BoardGeometry {
  return {
    kind: 'arc-track',
    dimensions: { arcTrack: { innerSize: 6, loopsPerCorner: 2 } },
    indexing: 'squares',
    adjacency: buildArcTrackAdjacency(),
    coordinateLabels: buildArcTrackCoordinates(),
    serializedKey: `arc-track-${preset}`,
  };
}

export function dotGridGeometry(opts: {
  boxesAcross: number;
  boxesDown: number;
}): BoardGeometry {
  const { boxesAcross, boxesDown } = opts;
  return {
    kind: 'dot-grid',
    dimensions: { dotGrid: { boxesAcross, boxesDown } },
    indexing: 'dots',
    adjacency: buildDotAdjacency({ boxesAcross, boxesDown }),
    coordinateLabels: buildDotCoordinates({ boxesAcross, boxesDown }),
    serializedKey: `dot-grid-${String(boxesAcross)}x${String(boxesDown)}`,
  };
}

export type MancalaPitPreset = 'oware-2x6' | 'bao-4x8';

export function mancalaPitGeometry(preset: MancalaPitPreset): BoardGeometry {
  const { rows, cols, sowingOrder, stores } = buildMancalaPitAdjacency(preset).dimensions;
  const adjacency = buildMancalaPitAdjacency(preset).graph;
  const coordinateLabels = buildMancalaPitCoordinates(preset);
  return {
    kind: 'mancala-pit',
    dimensions: {
      mancalaPit: {
        rows,
        cols,
        stores,
        sowingOrder,
      },
    },
    indexing: 'pits',
    adjacency,
    coordinateLabels,
    serializedKey: `mancala-${preset}`,
  };
}

export function withTerrainOverlay(
  base: BoardGeometry,
  overlays: readonly OverlayRegion[],
  overlayKey: string,
): BoardGeometry {
  return {
    kind: 'terrain-overlay',
    dimensions: {
      terrainOverlay: { baseKey: base.serializedKey, overlays },
    },
    indexing: base.indexing,
    adjacency: buildTerrainOverlayAdjacency(base.adjacency),
    coordinateLabels: base.coordinateLabels,
    serializedKey: `overlay-${base.serializedKey}+${overlayKey}`,
    playableMask: base.playableMask,
  };
}

export function irregularGeometry(opts: {
  serializedKey: string;
  adjacency: AdjacencyGraph;
  coordinateLabels: CoordinateLabeler;
  description?: string;
}): BoardGeometry {
  return {
    kind: 'irregular-registered',
    dimensions: { irregular: { description: opts.description ?? opts.serializedKey } },
    indexing: 'points',
    adjacency: opts.adjacency,
    coordinateLabels: opts.coordinateLabels,
    serializedKey: `irregular-${opts.serializedKey}`,
  };
}

export interface AlquerqueGeometryOptions {
  /** Side length (9 for Zamma; 5 for Bagh-Chal). */
  readonly size: number;
  /** Diagonal-line pattern. Defaults to `'alternating'` (Zamma's canonical pattern). */
  readonly diagonalPattern?: AlquerqueDiagonalPattern;
}

/**
 * Alquerque-grid geometry for Tier 2 #15 Zamma. Diagonals follow the
 * alternating pattern by default (a node `(r, c)` has diagonals iff
 * `(r + c) % 2 === 0`). Reusable for Bagh-Chal (5×5) and any future
 * full-diagonal alquerque variant via `diagonalPattern: 'full'`.
 */
export function alquerqueGeometry(opts: AlquerqueGeometryOptions): BoardGeometry {
  const { size, diagonalPattern = 'alternating' } = opts;
  const adjacency = buildAlquerqueAdjacency({ size, diagonalPattern });
  const coordinateLabels = buildAlquerqueCoordinates({ size });
  const keyParts = [`alquerque-${String(size)}x${String(size)}`];
  if (diagonalPattern === 'full') keyParts.push('full-diag');
  return {
    kind: 'alquerque',
    dimensions: { alquerque: { size, diagonalPattern } },
    indexing: 'intersections',
    adjacency,
    coordinateLabels,
    serializedKey: keyParts.join('-'),
  };
}

// Re-export the dark-squares-only helper so callers can build draughts geometries.
export { darkSquaresOnly };

// ---------------------------------------------------------------------------
// Terrain-overlay queries
// ---------------------------------------------------------------------------

export function overlayRegionFor(
  geometry: BoardGeometry,
  node: NodeId,
  regionName: string,
): boolean {
  const overlay = geometry.dimensions.terrainOverlay;
  if (!overlay) return false;
  const region = overlay.overlays.find((r) => r.name === regionName);
  if (!region) return false;
  return region.nodes.includes(node);
}

export function overlayNamesAt(geometry: BoardGeometry, node: NodeId): readonly string[] {
  const overlay = geometry.dimensions.terrainOverlay;
  if (!overlay) return [];
  return overlay.overlays.filter((r) => r.nodes.includes(node)).map((r) => r.name);
}
