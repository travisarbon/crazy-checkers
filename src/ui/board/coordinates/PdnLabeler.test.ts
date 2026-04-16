/**
 * PdnLabeler — unit tests (Task 28.4 §3.4).
 */

import { describe, expect, it } from 'vitest';
import { squareGeometry, asNodeId, darkSquaresOnly } from '../../../engine/boardGeometry';
import { createPdnLabeler } from './PdnLabeler';

const GEOM_8_DARK = squareGeometry({
  size: 8,
  indexing: 'squares',
  playableMask: darkSquaresOnly,
  variant: 'pdn-8',
});

const GEOM_10_DARK = squareGeometry({
  size: 10,
  indexing: 'squares',
  playableMask: darkSquaresOnly,
  variant: 'pdn-10',
});

const GEOM_12_DARK = squareGeometry({
  size: 12,
  indexing: 'squares',
  playableMask: darkSquaresOnly,
  variant: 'pdn-12',
});

const GEOM_8_FULL = squareGeometry({ size: 8, indexing: 'squares' });

describe('createPdnLabeler — variant detection', () => {
  it('detects PDN variant on 8×8 dark', () => {
    expect(createPdnLabeler(GEOM_8_DARK).isPdnVariant).toBe(true);
  });
  it('detects PDN variant on 10×10 dark', () => {
    expect(createPdnLabeler(GEOM_10_DARK).isPdnVariant).toBe(true);
  });
  it('detects PDN variant on 12×12 dark', () => {
    expect(createPdnLabeler(GEOM_12_DARK).isPdnVariant).toBe(true);
  });
  it('reports non-PDN for full-board 8×8', () => {
    expect(createPdnLabeler(GEOM_8_FULL).isPdnVariant).toBe(false);
  });
});

describe('createPdnLabeler — viewOf', () => {
  it('PDN-8 first dark square → primary "1", secondary "b8"', () => {
    const labeler = createPdnLabeler(GEOM_8_DARK);
    // Node id 1 is row 0, col 1 — the first dark square (b8 in algebraic).
    const view = labeler.viewOf(asNodeId(1));
    expect(view.primary).toBe('1');
    expect(view.secondary).toBe('b8');
    expect(view.hasPdn).toBe(true);
    expect(view.aria).toContain('draughts');
  });

  it('PDN-10 last dark square → primary "50"', () => {
    const labeler = createPdnLabeler(GEOM_10_DARK);
    // Node id 98 = row 9, col 8 (last dark square in row 9).
    const view = labeler.viewOf(asNodeId(98));
    expect(view.primary).toBe('50');
    expect(view.hasPdn).toBe(true);
  });

  it('PDN-12 last dark square → primary "72"', () => {
    const labeler = createPdnLabeler(GEOM_12_DARK);
    // Node id 142 = row 11, col 10 (last dark square in row 11).
    const view = labeler.viewOf(asNodeId(142));
    expect(view.primary).toBe('72');
    expect(view.hasPdn).toBe(true);
  });

  it('full-board 8×8 → primary algebraic, secondary null', () => {
    const labeler = createPdnLabeler(GEOM_8_FULL);
    const view = labeler.viewOf(asNodeId(0));
    expect(view.primary).toBe('a8');
    expect(view.secondary).toBeNull();
    expect(view.hasPdn).toBe(false);
  });

  it('PDN variant light square → primary algebraic, hasPdn false', () => {
    const labeler = createPdnLabeler(GEOM_8_DARK);
    // Node id 0 is row 0, col 0 — a light square in PDN-8 (no number).
    const view = labeler.viewOf(asNodeId(0));
    expect(view.primary).toBe('a8');
    expect(view.secondary).toBeNull();
    expect(view.hasPdn).toBe(false);
  });
});

describe('createPdnLabeler — pdnOf', () => {
  it('returns the integer for a PDN dark square', () => {
    expect(createPdnLabeler(GEOM_8_DARK).pdnOf(asNodeId(1))).toBe(1);
    expect(createPdnLabeler(GEOM_10_DARK).pdnOf(asNodeId(98))).toBe(50);
    expect(createPdnLabeler(GEOM_12_DARK).pdnOf(asNodeId(142))).toBe(72);
  });

  it('returns null for a light square in a PDN geometry', () => {
    expect(createPdnLabeler(GEOM_8_DARK).pdnOf(asNodeId(0))).toBeNull();
  });

  it('returns null for any node in a non-PDN geometry', () => {
    expect(createPdnLabeler(GEOM_8_FULL).pdnOf(asNodeId(0))).toBeNull();
    expect(createPdnLabeler(GEOM_8_FULL).pdnOf(asNodeId(63))).toBeNull();
  });
});
