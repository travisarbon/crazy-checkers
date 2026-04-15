import { describe, expect, it } from 'vitest';

import { hexRhombusGeometry, squareGeometry, darkSquaresOnly } from './boardGeometry';
import {
  DRAUGHTS_BOARD_GEOMETRY_V2,
  NotCogitateCompatibleError,
  fromCogitateGeometry,
  toCogitateGeometry,
} from './boardGeometry.cogitateShim';
import { DRAUGHTS_BOARD_GEOMETRY } from '../cogitate/types';

describe('boardGeometry.cogitateShim', () => {
  it('DRAUGHTS_BOARD_GEOMETRY_V2 is a kind=square descriptor', () => {
    expect(DRAUGHTS_BOARD_GEOMETRY_V2.kind).toBe('square');
    expect(DRAUGHTS_BOARD_GEOMETRY_V2.serializedKey).toBe('square-8x8-dark');
  });

  it('projects V2 onto the Cogitate struct', () => {
    const cog = toCogitateGeometry(DRAUGHTS_BOARD_GEOMETRY_V2);
    expect(cog).toEqual(DRAUGHTS_BOARD_GEOMETRY);
  });

  it('round-trips legacy Cogitate struct through the shim', () => {
    const v2 = fromCogitateGeometry(DRAUGHTS_BOARD_GEOMETRY);
    expect(v2.kind).toBe('square');
    expect(v2.dimensions.square?.size).toBe(8);
    expect(v2.playableMask).toBeDefined();
  });

  it('projects a full-square 10×10 (no dark mask)', () => {
    const g = squareGeometry({ size: 10, indexing: 'squares' });
    const cog = toCogitateGeometry(g);
    expect(cog).toEqual({
      gridType: 'full-square',
      rows: 10,
      cols: 10,
      playableSquares: 100,
      darkSquaresOnly: false,
    });
  });

  it('projects 10×10 dark', () => {
    const g = squareGeometry({ size: 10, indexing: 'squares', playableMask: darkSquaresOnly });
    const cog = toCogitateGeometry(g);
    expect(cog.playableSquares).toBe(50);
    expect(cog.darkSquaresOnly).toBe(true);
  });

  it('throws for non-square geometries', () => {
    expect(() => toCogitateGeometry(hexRhombusGeometry(11))).toThrow(
      NotCogitateCompatibleError,
    );
  });
});
