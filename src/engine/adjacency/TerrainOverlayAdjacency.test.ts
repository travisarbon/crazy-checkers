import { describe, expect, it } from 'vitest';

import { asNodeId } from '../boardGeometry';
import { buildRectangleAdjacency } from './RectangleAdjacency';
import { buildTerrainOverlayAdjacency } from './TerrainOverlayAdjacency';

describe('TerrainOverlayAdjacency — decorator pass-through', () => {
  const base = buildRectangleAdjacency({ width: 8, height: 8 });
  const overlay = buildTerrainOverlayAdjacency(base);

  it('mirrors base node count', () => {
    expect(overlay.nodeCount()).toBe(base.nodeCount());
  });

  it('passes direction kinds through', () => {
    expect(overlay.directionKinds).toEqual(base.directionKinds);
  });

  it('returns identical neighbors as base', () => {
    for (const node of base.listAllNodes()) {
      expect(overlay.ofKind('orthogonal', node)).toEqual(base.ofKind('orthogonal', node));
    }
  });

  it('hasNode mirrors base', () => {
    for (const node of base.listAllNodes()) {
      expect(overlay.hasNode(node)).toBe(true);
    }
    expect(overlay.hasNode(asNodeId(9999))).toBe(false);
  });

  it('listAllNodes returns the same IDs', () => {
    expect(overlay.listAllNodes()).toEqual(base.listAllNodes());
  });
});
