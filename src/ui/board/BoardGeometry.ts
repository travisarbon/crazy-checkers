/**
 * UI-facing re-export of the engine BoardGeometry descriptor.
 *
 * Renderer code (Task 27.3) imports from here; the implementation lives in
 * `src/engine/boardGeometry.ts` so non-UI subsystems (engine, AI, Cogitate)
 * can consume it without dragging React into the dependency graph.
 */

export type {
  AdjacencyGraph,
  BoardGeometry,
  BoardGeometryKind,
  CoordinateLabeler,
  DirectionKind,
  Dimensions,
  IndexingMode,
  NodeId,
  OverlayRegion,
  Predicate,
} from '../../engine/boardGeometry';
export {
  arcTrackGeometry,
  asNodeId,
  crossGeometry,
  dotGridGeometry,
  hexRhombusGeometry,
  hexTriangularGeometry,
  irregularGeometry,
  mancalaPitGeometry,
  overlayNamesAt,
  overlayRegionFor,
  rectangleGeometry,
  ringGeometry,
  squareGeometry,
  withTerrainOverlay,
  darkSquaresOnly,
} from '../../engine/boardGeometry';
