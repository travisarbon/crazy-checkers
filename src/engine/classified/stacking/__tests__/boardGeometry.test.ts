import { describe, expect, it } from 'vitest';
import { bashniBoardGeometry, lascaBoardGeometry } from '../boardGeometry';

describe('lascaBoardGeometry — 7×7 dark with parity 0', () => {
  const geom = lascaBoardGeometry();

  it('has 25 playable nodes', () => {
    expect(geom.adjacency.nodeCount()).toBe(25);
    expect(geom.adjacency.listAllNodes()).toHaveLength(25);
  });

  it('declares dimensions {square: {size: 7}}', () => {
    expect(geom.dimensions.square).toEqual({ size: 7 });
    expect(geom.kind).toBe('square');
    expect(geom.indexing).toBe('squares');
  });

  it('exposes a parity-0 playableMask', () => {
    expect(geom.playableMask).toBeDefined();
    if (!geom.playableMask) throw new Error('unreachable');
    // Bottom-left corner (r=6, c=0) → index 42; parity 0 → playable.
    expect(geom.playableMask(42 as never)).toBe(true);
    // (r=0, c=0) → index 0; parity 0 → playable.
    expect(geom.playableMask(0 as never)).toBe(true);
    // (r=0, c=1) → index 1; parity 1 → NOT playable.
    expect(geom.playableMask(1 as never)).toBe(false);
  });

  it('returns same instance on repeat call (cached)', () => {
    expect(lascaBoardGeometry()).toBe(geom);
  });

  it('PDN labels run from "1" through "25"', () => {
    const labels = geom.adjacency
      .listAllNodes()
      .map((n) => geom.coordinateLabels.notationOf(n));
    expect(labels).toEqual(
      Array.from({ length: 25 }, (_, i) => String(i + 1)),
    );
  });

  it('parseNotation accepts both PDN integers and algebraic forms', () => {
    const fromPdn = geom.coordinateLabels.parseNotation('1');
    const fromAlg = geom.coordinateLabels.parseNotation('a7');
    // (r=0, c=0) — algebraic a7 = (col 0, rank 7 → r=0). PDN 1 = first dark square.
    expect(fromPdn).toBe(0);
    expect(fromAlg).toBe(0);
  });

  it('parseNotation rejects unparsable tokens', () => {
    expect(geom.coordinateLabels.parseNotation('q1')).toBeNull();
    expect(geom.coordinateLabels.parseNotation('a99')).toBeNull();
    expect(geom.coordinateLabels.parseNotation('')).toBeNull();
  });

  it('diagonal adjacency excludes light squares', () => {
    // Pick a center playable square (r=3, c=3) → idx 24, parity 0.
    const center = 24;
    const diagNeighbors = geom.adjacency.ofKind('diagonal', center as never);
    expect(diagNeighbors).toHaveLength(4);
    // Diagonal neighbors at (2,2)=16, (2,4)=18, (4,2)=30, (4,4)=32.
    expect(new Set(diagNeighbors)).toEqual(new Set([16, 18, 30, 32]));
  });

  it('orthogonal adjacency excludes light squares (none for center)', () => {
    // Orthogonal neighbors of (3,3) = (2,3), (4,3), (3,2), (3,4) — all parity 1, NOT playable.
    const center = 24;
    const ortho = geom.adjacency.ofKind('orthogonal', center as never);
    expect(ortho).toHaveLength(0);
  });

  it('queen-line rays return only playable squares', () => {
    const center = 24;
    const queen = geom.adjacency.ofKind('queen-line', center as never);
    // Each playable square emitted; light squares filtered.
    for (const node of queen) {
      expect(geom.playableMask?.(node)).toBe(true);
    }
  });

  it('edge node hasNode returns true for playable squares only', () => {
    expect(geom.adjacency.hasNode(0 as never)).toBe(true);
    expect(geom.adjacency.hasNode(1 as never)).toBe(false);
  });

  it('ofKind on non-playable node returns []', () => {
    expect(geom.adjacency.ofKind('diagonal', 1 as never)).toEqual([]);
    expect(geom.adjacency.ofKind('orthogonal', 1 as never)).toEqual([]);
    expect(geom.adjacency.ofKind('queen-line', 1 as never)).toEqual([]);
  });

  it('serializedKey is stable', () => {
    expect(geom.serializedKey).toBe('square-7x7-dark-pdn');
  });

  it('aria labels include the lasca family', () => {
    expect(geom.coordinateLabels.ariaOf(0 as never)).toBe('lasca a7');
  });
});

describe('bashniBoardGeometry — 8×8 dark via shared helper', () => {
  const geom = bashniBoardGeometry();

  it('has 32 playable nodes', () => {
    expect(geom.adjacency.nodeCount()).toBe(32);
  });

  it('reuses the shared squareGeometry helper (pdn-8 variant key)', () => {
    expect(geom.serializedKey).toBe('square-8x8-dark');
  });

  it('returns same instance on repeat call', () => {
    expect(bashniBoardGeometry()).toBe(geom);
  });

  it('PDN labels run from "1" through "32"', () => {
    const labels = geom.adjacency
      .listAllNodes()
      .map((n) => geom.coordinateLabels.notationOf(n));
    // Dark squares with parity 1 in row-major are not numerically contiguous
    // but the PDN numbers themselves are 1..32. Sorting confirms.
    const numericLabels = [...labels].map(Number).sort((a, b) => a - b);
    expect(numericLabels).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
  });
});
