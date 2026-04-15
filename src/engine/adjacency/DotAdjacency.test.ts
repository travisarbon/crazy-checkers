import { describe, expect, it } from 'vitest';

import {
  boxId,
  buildDotAdjacency,
  dotId,
  dotLayout,
  hEdgeId,
  vEdgeId,
} from './DotAdjacency';

describe('DotAdjacency — 5×5 boxes', () => {
  const opts = { boxesAcross: 5, boxesDown: 5 };
  const graph = buildDotAdjacency(opts);
  const layout = dotLayout(opts);

  it('node count = dots + h-edges + v-edges + boxes', () => {
    expect(graph.nodeCount()).toBe(
      layout.dotCount + layout.hEdgeCount + layout.vEdgeCount + layout.boxCount,
    );
  });

  it('corner dot (0,0) has 2 incident edges', () => {
    expect(graph.ofKind('dot-edge', dotId(layout, 0, 0)).length).toBe(2);
  });

  it('edge dot (0,2) has 3 incident edges', () => {
    expect(graph.ofKind('dot-edge', dotId(layout, 0, 2)).length).toBe(3);
  });

  it('interior dot (2,2) has 4 incident edges', () => {
    expect(graph.ofKind('dot-edge', dotId(layout, 2, 2)).length).toBe(4);
  });

  it('box (0,0) has 4 bounding edges', () => {
    expect(graph.ofKind('box-neighbor', boxId(layout, 0, 0)).length).toBe(4);
  });

  it('corner box has 2 orthogonal box neighbors', () => {
    expect(graph.ofKind('orthogonal', boxId(layout, 0, 0)).length).toBe(2);
  });

  it('center box has 4 orthogonal box neighbors', () => {
    expect(graph.ofKind('orthogonal', boxId(layout, 2, 2)).length).toBe(4);
  });

  it('edge box has 3 orthogonal box neighbors', () => {
    expect(graph.ofKind('orthogonal', boxId(layout, 0, 2)).length).toBe(3);
  });

  it('returns empty for unknown direction', () => {
    expect(graph.ofKind('hex', boxId(layout, 0, 0))).toEqual([]);
  });

  it('hEdgeId and vEdgeId produce non-overlapping ranges', () => {
    expect(hEdgeId(layout, 0, 0)).not.toBe(vEdgeId(layout, 0, 0));
  });
});

describe('DotAdjacency — reference hand-verification (4×4)', () => {
  const opts = { boxesAcross: 4, boxesDown: 4 };
  const graph = buildDotAdjacency(opts);
  const layout = dotLayout(opts);
  const table: Array<[number, number, number, number]> = [
    // [r, c, expectedDotEdges, expectedBoxOrtho (-1 = skip)]
    [0, 0, 2, 2],
    [0, 4, 2, -1],
    [4, 0, 2, -1],
    [4, 4, 2, -1],
    [0, 2, 3, 3],
    [4, 2, 3, -1],
    [2, 0, 3, -1],
    [2, 4, 3, -1],
    [2, 2, 4, 4],
    [1, 1, 4, 4],
    [1, 2, 4, 4],
    [2, 1, 4, 4],
    [2, 3, 4, 3],
    [3, 3, 4, 2],
    [1, 3, 4, 3],
    [3, 1, 4, 3],
    [0, 1, 3, 3],
    [3, 0, 3, 2],
    [0, 3, 3, 2],
    [3, 4, 3, -1],
    [4, 1, 3, -1],
    [4, 3, 3, -1],
  ];
  for (const [r, c, expectedDotEdges, expectedBoxOrtho] of table) {
    it(`dot(${String(r)},${String(c)}) edges = ${String(expectedDotEdges)}, box ortho = ${String(expectedBoxOrtho)}`, () => {
      expect(graph.ofKind('dot-edge', dotId(layout, r, c)).length).toBe(expectedDotEdges);
      if (expectedBoxOrtho >= 0) {
        expect(graph.ofKind('orthogonal', boxId(layout, r, c)).length).toBe(expectedBoxOrtho);
      }
    });
  }
});
