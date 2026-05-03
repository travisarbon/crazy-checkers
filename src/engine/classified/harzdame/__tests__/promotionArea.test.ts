import { describe, expect, it } from 'vitest';
import { isInPromotionArea } from '../promotionArea';
import { createHarzdameConfig } from '../types';

describe('isInPromotionArea', () => {
  const config = createHarzdameConfig();

  it("white's promotion area contains PDN 1..11 by default", () => {
    for (let pdn = 1; pdn <= 11; pdn += 1) {
      const node = config.boardGeometry.coordinateLabels.parseNotation(String(pdn));
      expect(node).not.toBeNull();
      if (node === null) continue;
      expect(isInPromotionArea(node, 'white', config)).toBe(true);
    }
  });

  it("white's promotion area excludes PDN 12..32 by default", () => {
    for (let pdn = 12; pdn <= 32; pdn += 1) {
      const node = config.boardGeometry.coordinateLabels.parseNotation(String(pdn));
      expect(node).not.toBeNull();
      if (node === null) continue;
      expect(isInPromotionArea(node, 'white', config)).toBe(false);
    }
  });

  it("black's promotion area contains PDN 22..32 by default", () => {
    for (let pdn = 22; pdn <= 32; pdn += 1) {
      const node = config.boardGeometry.coordinateLabels.parseNotation(String(pdn));
      expect(node).not.toBeNull();
      if (node === null) continue;
      expect(isInPromotionArea(node, 'black', config)).toBe(true);
    }
  });

  it("black's promotion area excludes PDN 1..21 by default", () => {
    for (let pdn = 1; pdn <= 21; pdn += 1) {
      const node = config.boardGeometry.coordinateLabels.parseNotation(String(pdn));
      expect(node).not.toBeNull();
      if (node === null) continue;
      expect(isInPromotionArea(node, 'black', config)).toBe(false);
    }
  });

  it('promotion areas have cardinality 11 per side', () => {
    expect(config.promotionArea.white.size).toBe(11);
    expect(config.promotionArea.black.size).toBe(11);
  });
});
