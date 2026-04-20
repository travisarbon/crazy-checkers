import { describe, it, expect } from 'vitest';
import {
  getGeometryTables,
  getPawnAdvancement,
  countKingEscapes,
  getKingDirectionDeltas,
} from './geometryHelpers';
import {
  createRussianDraughtsConfig,
  createInternationalCheckersConfig,
  createCanadianDraughtsConfig,
  createArmenianDraughtsConfig,
  createTurkishDraughtsConfig,
} from '../../../engine/classified/draughts/DraughtsConfig';
import { asNodeId } from '../../../engine/boardGeometry';

describe('geometryHelpers', () => {
  describe('getGeometryTables', () => {
    it('caches results per config reference', () => {
      const config = createRussianDraughtsConfig();
      const t1 = getGeometryTables(config);
      const t2 = getGeometryTables(config);
      expect(t1).toBe(t2);
    });

    it('returns correct boardSize for 8×8 variants', () => {
      const tables = getGeometryTables(createRussianDraughtsConfig());
      expect(tables.boardSize).toBe(8);
    });

    it('returns correct boardSize for 10×10 variants', () => {
      const tables = getGeometryTables(createInternationalCheckersConfig());
      expect(tables.boardSize).toBe(10);
    });

    it('returns correct boardSize for 12×12 variants', () => {
      const tables = getGeometryTables(createCanadianDraughtsConfig());
      expect(tables.boardSize).toBe(12);
    });

    it('8×8 dark-square board has 32 playable nodes', () => {
      const tables = getGeometryTables(createRussianDraughtsConfig());
      expect(tables.playableNodes.size).toBe(32);
    });

    it('10×10 dark-square board has 50 playable nodes', () => {
      const tables = getGeometryTables(createInternationalCheckersConfig());
      expect(tables.playableNodes.size).toBe(50);
    });

    it('8×8 full-board has 64 playable nodes', () => {
      const tables = getGeometryTables(createArmenianDraughtsConfig());
      expect(tables.playableNodes.size).toBe(64);
    });

    it('center squares are non-empty for all board sizes', () => {
      const configs = [
        createRussianDraughtsConfig(),
        createInternationalCheckersConfig(),
        createCanadianDraughtsConfig(),
        createArmenianDraughtsConfig(),
      ];
      for (const config of configs) {
        const tables = getGeometryTables(config);
        expect(tables.centerSquares.size).toBeGreaterThan(0);
      }
    });

    it('expanded center does not overlap with core center', () => {
      const tables = getGeometryTables(createRussianDraughtsConfig());
      for (const node of tables.expandedCenterSquares) {
        expect(tables.centerSquares.has(node)).toBe(false);
      }
    });

    it('edge squares are on the perimeter', () => {
      const tables = getGeometryTables(createRussianDraughtsConfig());
      for (const node of tables.edgeSquares) {
        const idx = node as number;
        const r = Math.floor(idx / 8);
        const c = idx % 8;
        expect(r === 0 || r === 7 || c === 0 || c === 7).toBe(true);
      }
    });

    it('white back row is on the last row', () => {
      const tables = getGeometryTables(createRussianDraughtsConfig());
      for (const node of tables.whiteBackRow) {
        const r = Math.floor((node as number) / 8);
        expect(r).toBe(7);
      }
    });

    it('black back row is on the first row', () => {
      const tables = getGeometryTables(createRussianDraughtsConfig());
      for (const node of tables.blackBackRow) {
        const r = Math.floor((node as number) / 8);
        expect(r).toBe(0);
      }
    });
  });

  describe('getPawnAdvancement', () => {
    it('white pawn on last row has 0 advancement', () => {
      // Row 7, col 1 → nodeId = 57. Advancement = 8 - 1 - 7 = 0.
      expect(getPawnAdvancement(asNodeId(57), 'white', 8)).toBe(0);
    });

    it('white pawn on first row has max advancement', () => {
      // Row 0, col 1 → nodeId = 1. Advancement = 8 - 1 - 0 = 7.
      expect(getPawnAdvancement(asNodeId(1), 'white', 8)).toBe(7);
    });

    it('black pawn on first row has 0 advancement', () => {
      expect(getPawnAdvancement(asNodeId(1), 'black', 8)).toBe(0);
    });

    it('black pawn on last row has max advancement', () => {
      // Row 7. Advancement = 7.
      expect(getPawnAdvancement(asNodeId(57), 'black', 8)).toBe(7);
    });

    it('works correctly for 10×10 boards', () => {
      // Row 0, col 0 = nodeId 0. White advancement = 10-1-0 = 9.
      expect(getPawnAdvancement(asNodeId(0), 'white', 10)).toBe(9);
    });
  });

  describe('countKingEscapes', () => {
    it('king in corner of empty board has limited escapes', () => {
      const config = createArmenianDraughtsConfig(); // Full board
      const tables = getGeometryTables(config);
      const dirDeltas = getKingDirectionDeltas(config);
      const occupied = new Set([asNodeId(0)]); // Just the king itself

      // Corner (0,0) on an orthogonal-king board (Armenian kings move N/S/E/W).
      const escapes = countKingEscapes(
        asNodeId(0),
        dirDeltas,
        8,
        occupied,
        tables.playableNodes,
      );
      // At corner (0,0) with N/S/E/W directions: S and E are in-bounds.
      expect(escapes).toBe(2);
    });
  });

  describe('getKingDirectionDeltas', () => {
    it('Russian (diagonal kings) returns 4 directions', () => {
      const deltas = getKingDirectionDeltas(createRussianDraughtsConfig());
      expect(deltas).toHaveLength(4);
    });

    it('Turkish (orthogonal kings) returns 4 directions', () => {
      const deltas = getKingDirectionDeltas(createTurkishDraughtsConfig());
      expect(deltas).toHaveLength(4);
    });

    it('Armenian (orthogonal kings) returns 4 directions', () => {
      const deltas = getKingDirectionDeltas(createArmenianDraughtsConfig());
      expect(deltas).toHaveLength(4);
    });
  });
});
