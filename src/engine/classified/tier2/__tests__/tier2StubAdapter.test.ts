/**
 * Tier 2 stub adapter tests (Task 29.7).
 *
 * Verifies the stub adapter's contract methods either return valid values
 * (geometry, palette, notation, evaluation provider) OR throw a descriptive
 * "unsupported" error for the methods that need a per-game subtask C-block
 * adapter to fulfill (board ops, rule-set lookup, starting-position lookup).
 */

import { describe, expect, it } from 'vitest';
import { createTier2StubAdapter } from '../tier2StubAdapter';
import { createHarzdameRuleSet } from '../../harzdame/HarzdameRules';
import type { ClassifiedRuleSet } from '../../ClassifiedRuleSet';

const harzdameRuleSet: ClassifiedRuleSet =
  createHarzdameRuleSet() as unknown as ClassifiedRuleSet;

const adapter = createTier2StubAdapter({
  gameId: 'harzdame',
  modeId: 'classified-harzdame',
  ruleSet: harzdameRuleSet,
  boardGeometry: harzdameRuleSet.boardGeometry,
});

describe('createTier2StubAdapter', () => {
  it('exposes modeId', () => {
    expect(adapter.modeId).toBe('classified-harzdame');
  });

  it('returns a synthesised cogitate geometry', () => {
    const geom = adapter.getBoardGeometry();
    expect(geom.rows).toBe(8);
    expect(geom.cols).toBe(8);
    expect(geom.darkSquaresOnly).toBe(true);
  });

  it('returns an empty piece palette (Phase 4 piece registry handles this)', () => {
    expect(adapter.getPiecePalette()).toEqual([]);
  });

  it('returns the rule-set\'s onBoard piece vocabulary', () => {
    const palette = adapter.getOnBoardPalette?.();
    expect(palette).toBeDefined();
  });

  it('returns the rule-set\'s inHand piece vocabulary (likely empty)', () => {
    const palette = adapter.getHandPalette?.();
    expect(palette === undefined || Array.isArray(palette)).toBe(true);
  });

  it('returns a notation adapter', () => {
    expect(adapter.getNotationAdapter()).toBeDefined();
  });

  it('reports supportsEvaluation: false', () => {
    expect(adapter.supportsEvaluation()).toBe(false);
  });

  it('returns evaluation range [-1, 1]', () => {
    expect(adapter.getEvaluationRange()).toEqual([-1, 1]);
  });

  it('returns an evaluation provider with isAvailable: false', () => {
    const provider = adapter.getEvaluationProvider();
    expect(provider.isAvailable).toBe(false);
    expect(provider.providerType).toBe('classified-tier2-stub');
    expect(provider.evaluate(null as never, null as never)).toBeNull();
    expect(
      provider.getTopMoves(
        null as never,
        null as never,
        1,
        null as never,
        null as never,
      ),
    ).toEqual([]);
  });

  it('returns a default AI config (does not throw)', () => {
    expect(adapter.getAIConfig('easy')).toBeDefined();
  });

  it('validatePosition returns isLegal: true (stub default)', () => {
    const r = adapter.validatePosition(null as never);
    expect(r.isLegal).toBe(true);
  });

  it('throws on getBoard with descriptive message', () => {
    expect(() => adapter.getBoard('')).toThrow(/getBoard/);
  });

  it('throws on serializeBoard with descriptive message', () => {
    expect(() => adapter.serializeBoard(null as never)).toThrow(/serializeBoard/);
  });

  it('throws on getRuleSet with descriptive message', () => {
    expect(() => adapter.getRuleSet()).toThrow(/getRuleSet/);
  });

  it('throws on getStartingPosition with descriptive message', () => {
    expect(() => adapter.getStartingPosition()).toThrow(/getStartingPosition/);
  });
});
