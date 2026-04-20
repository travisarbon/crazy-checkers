import { describe, it, expect, beforeAll } from 'vitest';
import {
  runClassifiedReplayRoundTrip,
  runAllTier1ReplayRoundTrip,
} from './classifiedReplayRoundTrip';
import { loadClassifiedTier } from '../../engine/classified/tierLoader';
import { _clearClassifiedRegistry } from '../../engine/classified/registry';
import { _clearTierLoaderCache } from '../../engine/classified/tierLoader';
import { TIER_1_DRAUGHTS_GAME_IDS } from '../../engine/classified/draughts/DraughtsConfig';
import type { DraughtsGameId } from '../../engine/classified/draughts/DraughtsConfig';

describe('classifiedReplayRoundTrip', () => {
  beforeAll(async () => {
    _clearClassifiedRegistry();
    _clearTierLoaderCache();
    await loadClassifiedTier(1);
  });

  it.each([...TIER_1_DRAUGHTS_GAME_IDS])(
    '%s: replay round-trip passes with byte-identical serialization',
    (gameId: DraughtsGameId) => {
      const report = runClassifiedReplayRoundTrip(gameId, 2, 42);

      expect(report.gamesTested).toBe(2);
      expect(report.gamesFailed).toBe(0);
      expect(report.gamesPassed).toBe(2);
      expect(report.byteIdenticalSerialization).toBe(true);
      expect(report.notationRoundTripRate).toBe(1.0);
      expect(report.firstFailureIndex).toBeNull();
      expect(report.firstFailureReason).toBeNull();
    },
  );

  it('runAllTier1ReplayRoundTrip covers all 10 variants', () => {
    const reports = runAllTier1ReplayRoundTrip(1, 42);
    expect(reports).toHaveLength(10);

    for (const report of reports) {
      expect(report.gamesTested).toBe(1);
      expect(report.gamesFailed).toBe(0);
      expect(report.byteIdenticalSerialization).toBe(true);
    }
  });

  it('deterministic: same seed produces same results', () => {
    const r1 = runClassifiedReplayRoundTrip('russian-draughts', 2, 12345);
    const r2 = runClassifiedReplayRoundTrip('russian-draughts', 2, 12345);

    expect(r1.gamesPassed).toBe(r2.gamesPassed);
    expect(r1.gamesFailed).toBe(r2.gamesFailed);
    expect(r1.notationRoundTripRate).toBe(r2.notationRoundTripRate);
    expect(r1.byteIdenticalSerialization).toBe(r2.byteIdenticalSerialization);
  });
});
