import { describe, expect, it } from 'vitest';
import { asNodeId } from '../boardGeometry';
import {
  alternatingDiagonalAt,
  buildAlquerqueAdjacency,
} from './AlquerqueAdjacency';

const ZAMMA_REFERENCE: ReadonlyArray<{
  nodeId: number;
  r: number;
  c: number;
  hasDiagonals: boolean;
  ortho: readonly number[];
  diag: readonly number[];
}> = [
  { nodeId: 0, r: 0, c: 0, hasDiagonals: true, ortho: [1, 9], diag: [10] },
  { nodeId: 1, r: 0, c: 1, hasDiagonals: false, ortho: [0, 2, 10], diag: [] },
  { nodeId: 4, r: 0, c: 4, hasDiagonals: true, ortho: [3, 5, 13], diag: [12, 14] },
  { nodeId: 8, r: 0, c: 8, hasDiagonals: true, ortho: [7, 17], diag: [16] },
  { nodeId: 9, r: 1, c: 0, hasDiagonals: false, ortho: [0, 18, 10], diag: [] },
  { nodeId: 10, r: 1, c: 1, hasDiagonals: true, ortho: [1, 19, 9, 11], diag: [0, 2, 18, 20] },
  { nodeId: 17, r: 1, c: 8, hasDiagonals: false, ortho: [8, 26, 16], diag: [] },
  { nodeId: 21, r: 2, c: 3, hasDiagonals: false, ortho: [12, 30, 20, 22], diag: [] },
  { nodeId: 22, r: 2, c: 4, hasDiagonals: true, ortho: [13, 31, 21, 23], diag: [12, 14, 30, 32] },
  { nodeId: 36, r: 4, c: 0, hasDiagonals: true, ortho: [27, 45, 37], diag: [28, 46] },
  { nodeId: 40, r: 4, c: 4, hasDiagonals: true, ortho: [31, 49, 39, 41], diag: [30, 32, 48, 50] },
  { nodeId: 44, r: 4, c: 8, hasDiagonals: true, ortho: [35, 53, 43], diag: [34, 52] },
  { nodeId: 72, r: 8, c: 0, hasDiagonals: true, ortho: [63, 73], diag: [64] },
  { nodeId: 76, r: 8, c: 4, hasDiagonals: true, ortho: [67, 75, 77], diag: [66, 68] },
  { nodeId: 80, r: 8, c: 8, hasDiagonals: true, ortho: [71, 79], diag: [70] },
];

describe('AlquerqueAdjacency — alternating diagonal pattern (Zamma 9×9)', () => {
  const graph = buildAlquerqueAdjacency({ size: 9, diagonalPattern: 'alternating' });

  it('exposes exactly two direction kinds: orthogonal and diagonal', () => {
    expect([...graph.directionKinds]).toEqual(['orthogonal', 'diagonal']);
  });

  it('declares 81 nodes', () => {
    expect(graph.nodeCount()).toBe(81);
    expect(graph.listAllNodes()).toHaveLength(81);
  });

  it('hasNode returns true for every NodeId in [0, 81)', () => {
    for (let i = 0; i < 81; i += 1) {
      expect(graph.hasNode(asNodeId(i))).toBe(true);
    }
  });

  it('hasNode returns false for out-of-range NodeIds', () => {
    expect(graph.hasNode(asNodeId(81))).toBe(false);
    expect(graph.hasNode(asNodeId(-1))).toBe(false);
  });

  describe('reference neighbor sets', () => {
    for (const ref of ZAMMA_REFERENCE) {
      it(`node ${String(ref.nodeId)} (${String(ref.r)}, ${String(ref.c)})`, () => {
        const node = asNodeId(ref.nodeId);
        const ortho = graph.ofKind('orthogonal', node).map((n) => n as unknown as number);
        const diag = graph.ofKind('diagonal', node).map((n) => n as unknown as number);
        expect([...ortho].sort((a, b) => a - b)).toEqual([...ref.ortho].sort((a, b) => a - b));
        expect([...diag].sort((a, b) => a - b)).toEqual([...ref.diag].sort((a, b) => a - b));
      });
    }
  });

  it('alternatingDiagonalAt is true iff (r+c) is even', () => {
    expect(alternatingDiagonalAt(0, 0)).toBe(true);
    expect(alternatingDiagonalAt(0, 1)).toBe(false);
    expect(alternatingDiagonalAt(4, 4)).toBe(true);
    expect(alternatingDiagonalAt(2, 3)).toBe(false);
    expect(alternatingDiagonalAt(8, 8)).toBe(true);
  });

  it('queen-line and unknown direction kinds return empty arrays', () => {
    const node = asNodeId(40);
    expect(graph.ofKind('queen-line', node)).toEqual([]);
    expect(graph.ofKind('hex', node)).toEqual([]);
    expect(graph.ofKind('ring-spoke', node)).toEqual([]);
  });

  it('returns empty arrays for out-of-range NodeIds', () => {
    expect(graph.ofKind('orthogonal', asNodeId(81))).toEqual([]);
    expect(graph.ofKind('diagonal', asNodeId(81))).toEqual([]);
  });

  it('no node lists itself as a neighbor', () => {
    for (let i = 0; i < 81; i += 1) {
      const node = asNodeId(i);
      const ortho = graph.ofKind('orthogonal', node);
      const diag = graph.ofKind('diagonal', node);
      for (const n of ortho) {
        expect(n as unknown as number).not.toBe(i);
      }
      for (const n of diag) {
        expect(n as unknown as number).not.toBe(i);
      }
    }
  });

  it('orthogonal adjacency is symmetric (a ∈ adj(b) iff b ∈ adj(a))', () => {
    for (let i = 0; i < 81; i += 1) {
      const a = asNodeId(i);
      for (const b of graph.ofKind('orthogonal', a)) {
        const reverse = graph.ofKind('orthogonal', b).map((n) => n as unknown as number);
        expect(reverse).toContain(i);
      }
    }
  });

  it('diagonal adjacency is symmetric', () => {
    for (let i = 0; i < 81; i += 1) {
      const a = asNodeId(i);
      for (const b of graph.ofKind('diagonal', a)) {
        const reverse = graph.ofKind('diagonal', b).map((n) => n as unknown as number);
        expect(reverse).toContain(i);
      }
    }
  });

  it('every diagonal connection joins two has-diagonals nodes', () => {
    for (let i = 0; i < 81; i += 1) {
      const a = asNodeId(i);
      for (const b of graph.ofKind('diagonal', a)) {
        const idx = b as unknown as number;
        const r = Math.floor(idx / 9);
        const c = idx % 9;
        expect(alternatingDiagonalAt(r, c)).toBe(true);
      }
    }
  });
});

describe('AlquerqueAdjacency — full diagonal pattern (variant)', () => {
  const graph = buildAlquerqueAdjacency({ size: 9, diagonalPattern: 'full' });

  it('every interior node has 4 diagonals', () => {
    // (r=4, c=4) interior
    const node = asNodeId(4 * 9 + 4);
    const diag = graph.ofKind('diagonal', node);
    expect(diag).toHaveLength(4);
  });

  it('a node that lacks diagonals in alternating pattern has them in full pattern', () => {
    // (r=0, c=1) is an alternating-no-diagonal node, but should have diagonals here.
    const node = asNodeId(1);
    const diag = graph.ofKind('diagonal', node);
    expect(diag.length).toBeGreaterThan(0);
  });
});

describe('AlquerqueAdjacency — Bagh-Chal-style 5×5', () => {
  const graph = buildAlquerqueAdjacency({ size: 5, diagonalPattern: 'alternating' });

  it('has 25 nodes', () => {
    expect(graph.nodeCount()).toBe(25);
  });

  it('center node (2, 2) has 4 orthogonal + 4 diagonal neighbors (alternating pattern)', () => {
    const center = asNodeId(2 * 5 + 2);
    expect(graph.ofKind('orthogonal', center)).toHaveLength(4);
    expect(graph.ofKind('diagonal', center)).toHaveLength(4);
  });
});
