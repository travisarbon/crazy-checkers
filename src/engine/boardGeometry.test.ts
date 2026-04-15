import { describe, expect, it } from 'vitest';

import {
  arcTrackGeometry,
  asNodeId,
  crossGeometry,
  darkSquaresOnly,
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
} from './boardGeometry';

describe('BoardGeometry — factory stable keys (snapshot)', () => {
  it('square-8x8', () => {
    expect(
      squareGeometry({ size: 8, indexing: 'squares' }).serializedKey,
    ).toBe('square-8x8');
  });

  it('square-8x8-dark', () => {
    expect(
      squareGeometry({
        size: 8,
        indexing: 'squares',
        playableMask: darkSquaresOnly,
      }).serializedKey,
    ).toBe('square-8x8-dark');
  });

  it('square-10x10-dark', () => {
    expect(
      squareGeometry({
        size: 10,
        indexing: 'squares',
        playableMask: darkSquaresOnly,
      }).serializedKey,
    ).toBe('square-10x10-dark');
  });

  it('square-19x19-inter', () => {
    expect(
      squareGeometry({ size: 19, indexing: 'intersections' }).serializedKey,
    ).toBe('square-19x19-inter');
  });

  it('rectangle-9x5-squares', () => {
    expect(
      rectangleGeometry({ width: 9, height: 5, indexing: 'squares' }).serializedKey,
    ).toBe('rectangle-9x5-squares');
  });

  it('rectangle-9x10-intersections', () => {
    expect(
      rectangleGeometry({ width: 9, height: 10, indexing: 'intersections' }).serializedKey,
    ).toBe('rectangle-9x10-intersections');
  });

  it('hex-rhombus-11', () => {
    expect(hexRhombusGeometry(11).serializedKey).toBe('hex-rhombus-11');
  });

  it('hex-triangular-6', () => {
    expect(hexTriangularGeometry(6).serializedKey).toBe('hex-triangular-6');
  });

  it('ring-nmm and ring-morabaraba', () => {
    expect(ringGeometry('nmm').serializedKey).toBe('ring-nmm');
    expect(ringGeometry('morabaraba').serializedKey).toBe('ring-morabaraba');
  });

  it('cross-fox-and-geese', () => {
    expect(crossGeometry('fox-and-geese').serializedKey).toBe('cross-fox-and-geese');
  });

  it('arc-track-surakarta', () => {
    expect(arcTrackGeometry('surakarta').serializedKey).toBe('arc-track-surakarta');
  });

  it('dot-grid-5x5', () => {
    expect(dotGridGeometry({ boxesAcross: 5, boxesDown: 5 }).serializedKey).toBe(
      'dot-grid-5x5',
    );
  });

  it('mancala-oware-2x6 / mancala-bao-4x8', () => {
    expect(mancalaPitGeometry('oware-2x6').serializedKey).toBe('mancala-oware-2x6');
    expect(mancalaPitGeometry('bao-4x8').serializedKey).toBe('mancala-bao-4x8');
  });

  it('overlay key composes from base + overlay', () => {
    const base = squareGeometry({ size: 8, indexing: 'squares' });
    const overlaid = withTerrainOverlay(base, [], 'arimaa-traps');
    expect(overlaid.serializedKey).toBe('overlay-square-8x8+arimaa-traps');
  });

  it('irregular key has irregular prefix', () => {
    const adj = {
      directionKinds: [] as const,
      ofKind: () => [] as never[],
      listAllNodes: () => [] as never[],
      hasNode: () => false,
      nodeCount: () => 0,
    };
    const labels = {
      notationOf: () => 'x',
      displayOf: () => 'x',
      ariaOf: () => 'x',
      parseNotation: () => null,
    };
    const geom = irregularGeometry({
      serializedKey: 'camelot',
      adjacency: adj,
      coordinateLabels: labels,
    });
    expect(geom.serializedKey).toBe('irregular-camelot');
  });
});

describe('BoardGeometry — descriptor shape', () => {
  it('every geometry exposes kind, indexing, serializedKey, adjacency, coordinateLabels', () => {
    const all = [
      squareGeometry({ size: 8, indexing: 'squares', playableMask: darkSquaresOnly }),
      rectangleGeometry({ width: 9, height: 5, indexing: 'squares' }),
      hexRhombusGeometry(11),
      hexTriangularGeometry(6),
      ringGeometry('nmm'),
      crossGeometry('fox-and-geese'),
      arcTrackGeometry('surakarta'),
      dotGridGeometry({ boxesAcross: 5, boxesDown: 5 }),
      mancalaPitGeometry('oware-2x6'),
    ];
    for (const g of all) {
      expect(g.kind).toBeDefined();
      expect(g.indexing).toBeDefined();
      expect(g.serializedKey).toMatch(/^[a-z0-9-]+$/);
      expect(g.adjacency.directionKinds.length).toBeGreaterThan(0);
      expect(typeof g.coordinateLabels.notationOf).toBe('function');
    }
  });
});

describe('BoardGeometry — overlay queries', () => {
  const base = squareGeometry({ size: 8, indexing: 'squares' });
  const traps = [asNodeId(18), asNodeId(21)];
  const overlaid = withTerrainOverlay(
    base,
    [{ name: 'trap', nodes: traps }],
    'arimaa-traps',
  );

  it('overlayRegionFor returns true for members', () => {
    expect(overlayRegionFor(overlaid, asNodeId(18), 'trap')).toBe(true);
  });

  it('overlayRegionFor returns false for non-members', () => {
    expect(overlayRegionFor(overlaid, asNodeId(0), 'trap')).toBe(false);
  });

  it('overlayRegionFor returns false on non-overlay geometry', () => {
    expect(overlayRegionFor(base, asNodeId(0), 'trap')).toBe(false);
  });

  it('overlayNamesAt lists matching regions', () => {
    expect(overlayNamesAt(overlaid, asNodeId(18))).toEqual(['trap']);
    expect(overlayNamesAt(overlaid, asNodeId(0))).toEqual([]);
  });

  it('overlayNamesAt returns empty on non-overlay geometry', () => {
    expect(overlayNamesAt(base, asNodeId(0))).toEqual([]);
  });
});
