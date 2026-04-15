import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerBoardRenderer,
  getBoardRenderer,
  listRegisteredRenderers,
  BoardRendererMissingError,
  asRendererKey,
  __resetBoardRendererRegistryForTests,
} from './BoardRendererRegistry';
import { registerDefaultBoardRenderers } from './index';
import {
  squareGeometry,
  rectangleGeometry,
  hexRhombusGeometry,
  hexTriangularGeometry,
  ringGeometry,
  crossGeometry,
  arcTrackGeometry,
  dotGridGeometry,
  mancalaPitGeometry,
  withTerrainOverlay,
  irregularGeometry,
} from '../../engine/boardGeometry';

const Noop = (): null => null;

describe('BoardRendererRegistry', () => {
  beforeEach(() => {
    __resetBoardRendererRegistryForTests();
    registerDefaultBoardRenderers();
  });

  it('resolves every default BoardGeometryKind to a renderer', () => {
    const square = squareGeometry({ size: 8, indexing: 'squares' });
    expect(getBoardRenderer(square)).toBeDefined();

    const rect = rectangleGeometry({ width: 9, height: 5, indexing: 'intersections' });
    expect(getBoardRenderer(rect)).toBeDefined();

    expect(getBoardRenderer(hexRhombusGeometry(11))).toBeDefined();
    expect(getBoardRenderer(hexTriangularGeometry(5))).toBeDefined();
    expect(getBoardRenderer(ringGeometry('nmm'))).toBeDefined();
    expect(getBoardRenderer(ringGeometry('morabaraba'))).toBeDefined();
    expect(getBoardRenderer(crossGeometry('fox-and-geese'))).toBeDefined();
    expect(getBoardRenderer(arcTrackGeometry('surakarta'))).toBeDefined();
    expect(getBoardRenderer(dotGridGeometry({ boxesAcross: 5, boxesDown: 5 }))).toBeDefined();
    expect(getBoardRenderer(mancalaPitGeometry('oware-2x6'))).toBeDefined();

    const base = squareGeometry({ size: 8, indexing: 'squares' });
    const overlay = withTerrainOverlay(base, [], 'empty');
    expect(getBoardRenderer(overlay)).toBeDefined();
  });

  it('throws BoardRendererMissingError for unregistered kinds', () => {
    __resetBoardRendererRegistryForTests();
    const square = squareGeometry({ size: 8, indexing: 'squares' });
    expect(() => getBoardRenderer(square)).toThrow(BoardRendererMissingError);
  });

  it('listRegisteredRenderers returns all registered entries', () => {
    const entries = listRegisteredRenderers();
    const kinds = new Set(entries.map((e) => e.kind));
    expect(kinds.has('square')).toBe(true);
    expect(kinds.has('rectangle')).toBe(true);
    expect(kinds.has('hex-rhombus')).toBe(true);
    expect(kinds.has('hex-triangular')).toBe(true);
    expect(kinds.has('ring')).toBe(true);
    expect(kinds.has('cross')).toBe(true);
    expect(kinds.has('arc-track')).toBe(true);
    expect(kinds.has('dot-grid')).toBe(true);
    expect(kinds.has('mancala-pit')).toBe(true);
    expect(kinds.has('terrain-overlay')).toBe(true);
  });

  it('matchesGeometry predicate wins over default for Morabaraba', () => {
    const nmm = getBoardRenderer(ringGeometry('nmm'));
    const morabaraba = getBoardRenderer(ringGeometry('morabaraba'));
    expect(nmm).toBe(morabaraba);
  });

  it('replaces entries with duplicate keys', () => {
    registerBoardRenderer({
      key: asRendererKey('square'),
      kind: 'square',
      component: Noop,
      supportsPreview: true,
    });
    const entries = listRegisteredRenderers();
    const squareEntries = entries.filter((e) => e.key === asRendererKey('square'));
    expect(squareEntries).toHaveLength(1);
  });

  it('irregular-registered geometries return registered renderer or throw', () => {
    const fakeGraph = {
      directionKinds: [] as const,
      ofKind: () => [],
      listAllNodes: () => [],
      hasNode: () => false,
      nodeCount: () => 0,
    };
    const fakeLabels = {
      ariaOf: () => '',
      notationOf: () => '',
      displayOf: () => '',
      parseNotation: () => null,
    };
    const geom = irregularGeometry({
      serializedKey: 'camelot',
      adjacency: fakeGraph,
      coordinateLabels: fakeLabels,
    });
    expect(() => getBoardRenderer(geom)).toThrow(BoardRendererMissingError);

    registerBoardRenderer({
      key: asRendererKey('irregular-camelot'),
      kind: 'irregular-registered',
      component: Noop,
      supportsPreview: false,
    });
    expect(getBoardRenderer(geom)).toBe(Noop);
  });
});
