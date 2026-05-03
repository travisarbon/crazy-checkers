/**
 * usePhalanxSelection helper tests (Phase 4 Task 29.G.1-B §8.1).
 */

import { describe, expect, it } from 'vitest';
import { asNodeId } from '../../../engine/boardGeometry';
import { createDameoConfig } from '../../../engine/classified/linear/types';
import { buildStartingState } from '../../../engine/classified/linear/startingPosition';
import {
  EMPTY_PHALANX_SELECTION,
  computePhalanxSelection,
  hasAnyPhalanx,
} from '../usePhalanxSelection';

const cfg = createDameoConfig();

describe('computePhalanxSelection', () => {
  it('returns empty selection when hoveredNodeId is null', () => {
    const start = buildStartingState(cfg);
    const sel = computePhalanxSelection(start, cfg, 'white', null);
    expect(sel).toEqual(EMPTY_PHALANX_SELECTION);
    expect(sel.availablePhalanxes).toHaveLength(0);
  });

  it('returns at least one phalanx for a hovered back-row pawn in the trapezoid starting position', () => {
    const start = buildStartingState(cfg);
    // White's back-row pawn at a1 (row 7, col 0) — NodeId 56.
    const a1 = asNodeId(7 * 8 + 0);
    const sel = computePhalanxSelection(start, cfg, 'white', a1);
    expect(sel.hoveredNodeId).toBe(a1);
    // The starting position has at least one phalanx through a1 (the
    // back-rank rank phalanx + diagonals).
    expect(sel.availablePhalanxes.length).toBeGreaterThan(0);
  });

  it('returns empty when hovered piece is not in any phalanx-of-2+', () => {
    const start = buildStartingState(cfg);
    // A square with no friendly piece — shouldn't be in any phalanx.
    const empty = asNodeId(4 * 8 + 4); // (4, 4) center, empty in starting trapezoid.
    const sel = computePhalanxSelection(start, cfg, 'white', empty);
    expect(sel.availablePhalanxes).toHaveLength(0);
  });
});

describe('hasAnyPhalanx', () => {
  it('returns true on the trapezoid starting position', () => {
    const start = buildStartingState(cfg);
    expect(hasAnyPhalanx(start, cfg, 'white')).toBe(true);
    expect(hasAnyPhalanx(start, cfg, 'black')).toBe(true);
  });
});
