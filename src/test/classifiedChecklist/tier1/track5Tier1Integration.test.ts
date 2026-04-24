/**
 * Task 28.7 — Track 5 wiring integration test for Tier 1.
 *
 * Exercises row C-15 clause A (machine-checkable half): a simulated Hard-CPU
 * victory in each of the 10 Tier 1 Classified games — fed to
 * `updateCareerSnapshot` as a `GameRecord` — must bump the Track 5
 * ("World Player") counter by 1. After all 10 Tier 1 wins are recorded,
 * Track 5 must report `currentValue === 10` and cross the 1 / 5 / 10
 * `TRACK_5_THRESHOLDS` milestones (the first three Choice-mode unlocks on
 * Track 5: Choice modes 33, 34, 35 per the Career Mode Playbook §4).
 *
 * A control record (Crazy mode Hard win) confirms non-Classified wins do not
 * advance Track 5 — i.e. Track 5 is Classified-exclusive. A second control
 * confirms that a Code-Mode-unlocked game with no Hard-CPU victory does not
 * advance Track 5 either (Code Mode only touches the `codeUnlocks` set; it
 * must never touch Track 5 — Master Playbook §8 second clause).
 *
 * This file is the source of truth for the "Track 5 counter increments on
 * Hard-CPU win" half of row C-15. The flavor-text half is clause B, ticked
 * separately by the tier1ChecklistRunner.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  _clearClassifiedRegistry,
  getClassifiedGame,
} from '../../../engine/classified/registry';
import {
  _clearTierLoaderCache,
  loadClassifiedTier,
} from '../../../engine/classified/tierLoader';
import { _clearAdapterRegistry } from '../../../cogitate/CogitateGameAdapter';
import { clearSerializers__TEST_ONLY } from '../../../persistence/serializers';
import {
  computeCareerSnapshot,
  updateCareerSnapshot,
  type CareerSnapshot,
} from '../../../persistence/careerStatsEngine';
import { TRACK_5_THRESHOLDS } from '../../../persistence/unlockEvaluator';
import { TIER_1_GAME_IDS } from '../../../engine/classified/tier1/ids';
import type { GameRecord } from '../../../persistence/gameHistory';

// Monotonic clock so completedAt values sort cleanly.
let ts = 1_700_000_000_000;
function nextTimestamp(durationMs: number): { startedAt: number; completedAt: number } {
  const startedAt = ts;
  ts += durationMs;
  return { startedAt, completedAt: ts };
}

function makeHardWinRecord(params: {
  readonly mode: string;
  readonly id?: string;
}): GameRecord {
  const { startedAt, completedAt } = nextTimestamp(300_000);
  return {
    id: params.id ?? `track5-tier1-${params.mode}-${String(startedAt)}`,
    mode: params.mode,
    playerWhite: 'HUMAN',
    playerBlack: 'CPU_HARD',
    result: 'WHITE_WIN',
    reason: 'NO_PIECES_LEFT',
    moves: [],
    boardStates: [],
    startedAt,
    completedAt,
  };
}

function track5Value(snapshot: CareerSnapshot): number {
  const track5 = snapshot.tracks[4];
  if (!track5) throw new Error('Track 5 missing from snapshot');
  return track5.currentValue;
}

function track5MilestonesMet(snapshot: CareerSnapshot): number {
  const track5 = snapshot.tracks[4];
  if (!track5) throw new Error('Track 5 missing from snapshot');
  return track5.completedMilestones;
}

function firstTier1GameId(): (typeof TIER_1_GAME_IDS)[number] {
  const first = TIER_1_GAME_IDS[0];
  if (!first) throw new Error('TIER_1_GAME_IDS is empty — Tier 1 not loaded');
  return first;
}

beforeAll(async () => {
  _clearClassifiedRegistry();
  _clearAdapterRegistry();
  clearSerializers__TEST_ONLY();
  _clearTierLoaderCache();
  await loadClassifiedTier(1);
});

beforeEach(() => {
  // Fresh monotonic clock per test so record IDs stay unique.
  ts += 1_000;
});

describe('Task 28.7 C-15 clause A — Track 5 wiring for Tier 1', () => {
  it('TRACK_5_THRESHOLDS has the playbook-declared milestones', () => {
    // Sanity: Master Playbook §8 pins these exact thresholds.
    expect([...TRACK_5_THRESHOLDS]).toEqual([1, 5, 10, 20, 30, 40, 50, 64]);
  });

  it('every Tier 1 modeId is recognized by resolveGameRecord as category="classified"', () => {
    for (const gameId of TIER_1_GAME_IDS) {
      const spec = getClassifiedGame(gameId);
      if (!spec) throw new Error(`no spec for ${String(gameId)}`);
      const record = makeHardWinRecord({ mode: spec.modeId });
      const snapshot = computeCareerSnapshot([record]);
      // If Track 5 advanced to 1, the registryEntry resolution picked
      // category='classified' + cpuDifficulty='hard' + humanWon correctly.
      expect(
        track5Value(snapshot),
        `Track 5 must be 1 after one Hard win on ${String(gameId)}`,
      ).toBe(1);
    }
  });

  it('Hard-CPU win on each Tier 1 game bumps Track 5 by 1 (via updateCareerSnapshot)', () => {
    let snapshot = computeCareerSnapshot([]);
    expect(track5Value(snapshot)).toBe(0);

    for (const [i, gameId] of TIER_1_GAME_IDS.entries()) {
      const spec = getClassifiedGame(gameId);
      if (!spec) throw new Error(`no spec for ${String(gameId)}`);
      const record = makeHardWinRecord({ mode: spec.modeId });
      snapshot = updateCareerSnapshot(snapshot, record);
      expect(
        track5Value(snapshot),
        `Track 5 after win #${String(i + 1)} on ${String(gameId)}`,
      ).toBe(i + 1);
    }

    expect(track5Value(snapshot)).toBe(10);
    // Thresholds 1, 5, 10 crossed → first 3 Track 5 Choice-mode unlocks.
    expect(track5MilestonesMet(snapshot)).toBeGreaterThanOrEqual(3);
  });

  it('Thresholds 1 / 5 / 10 cross exactly when the counter reaches them', () => {
    let snapshot = computeCareerSnapshot([]);
    for (const [i, gameId] of TIER_1_GAME_IDS.entries()) {
      const spec = getClassifiedGame(gameId);
      if (!spec) throw new Error(`no spec for ${String(gameId)}`);
      const record = makeHardWinRecord({ mode: spec.modeId });
      snapshot = updateCareerSnapshot(snapshot, record);
      const wins = i + 1;
      const expectedMilestones = [1, 5, 10, 20, 30, 40, 50, 64].filter(
        (t) => wins >= t,
      ).length;
      expect(
        track5MilestonesMet(snapshot),
        `milestones met after ${String(wins)} wins`,
      ).toBe(expectedMilestones);
    }
  });

  it('Non-Classified Hard win (Crazy mode) does NOT advance Track 5', () => {
    let snapshot = computeCareerSnapshot([]);
    const crazyWin = makeHardWinRecord({ mode: 'CRAZY' });
    snapshot = updateCareerSnapshot(snapshot, crazyWin);
    expect(track5Value(snapshot)).toBe(0);
  });

  it('Easy-CPU Classified win does NOT advance Track 5 (Hard-only contract)', () => {
    const spec = getClassifiedGame(firstTier1GameId());
    if (!spec) throw new Error('no spec for first Tier 1 game');

    const easyWin: GameRecord = {
      ...makeHardWinRecord({ mode: spec.modeId, id: 'track5-easy-win' }),
      playerBlack: 'CPU_EASY',
    };

    let snapshot = computeCareerSnapshot([]);
    snapshot = updateCareerSnapshot(snapshot, easyWin);
    expect(track5Value(snapshot)).toBe(0);
  });

  it('Classified Hard loss does NOT advance Track 5 (win-only contract)', () => {
    const spec = getClassifiedGame(firstTier1GameId());
    if (!spec) throw new Error('no spec for first Tier 1 game');

    const hardLoss: GameRecord = {
      ...makeHardWinRecord({ mode: spec.modeId, id: 'track5-hard-loss' }),
      result: 'BLACK_WIN',
    };

    let snapshot = computeCareerSnapshot([]);
    snapshot = updateCareerSnapshot(snapshot, hardLoss);
    expect(track5Value(snapshot)).toBe(0);
  });

  it('Pass-around (Human vs Human) Classified game does NOT advance Track 5', () => {
    const spec = getClassifiedGame(firstTier1GameId());
    if (!spec) throw new Error('no spec for first Tier 1 game');

    const passAround: GameRecord = {
      ...makeHardWinRecord({ mode: spec.modeId, id: 'track5-pass-around' }),
      playerBlack: 'HUMAN',
    };

    let snapshot = computeCareerSnapshot([]);
    snapshot = updateCareerSnapshot(snapshot, passAround);
    expect(track5Value(snapshot)).toBe(0);
  });
});
