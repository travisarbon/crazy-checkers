/**
 * Task 24.1 — progression flow integration tests.
 *
 * Validates end-to-end interactions between Challenge, Choice, Career,
 * and the 5-track unlock evaluator. Where a step would normally require
 * a full game to be played, these tests use seed helpers to establish
 * the persistence state more directly.
 */

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../engine/events/index';

import {
  CrazyEvent,
  GameMode,
  PlayerType,
} from '../engine/types';
import {
  computeCareerSnapshot,
  loadAndComputeCareerSnapshot,
} from '../persistence/careerStatsEngine';
import {
  getAllChallengeRecords,
  clearChallengeHistory,
} from '../persistence/challengeRecords';
import {
  evaluateFullUnlockState,
  loadCodeUnlocks,
  clearCodeUnlocks,
  saveCodeUnlocks,
} from '../persistence/unlockEvaluator';
import {
  clearUnlockState,
} from '../persistence/unlockState';
import {
  clearGameHistory,
  getAllGameRecords,
  recordGame,
} from '../persistence/gameHistory';
import {
  clearRedemptionHistory,
} from '../persistence/redemptionHistory';
import {
  getModeOrFallback,
  getModesByCategory,
} from '../persistence/gameModeRegistry';
import { createAmericanRules } from '../engine/rules';
import { createNewChoiceGame, getCurrentLegalMoves, makeMove } from '../engine/game';
import {
  seedChallengeRecords,
  seedGameRecord,
  createSeededRandom,
} from './testUtils';
import { serializeActiveEvents, serializeBoard, type SerializedActiveEvent } from '../persistence/serialization';

async function resetAll(): Promise<void> {
  clearUnlockState();
  clearCodeUnlocks();
  clearRedemptionHistory();
  saveCodeUnlocks(new Set());
  await clearGameHistory();
  await clearChallengeHistory();
}

describe('Task 24.1 — progression flow', () => {
  beforeEach(async () => {
    localStorage.clear();
    await resetAll();
  });

  afterEach(async () => {
    localStorage.clear();
    await resetAll();
  });

  // -------------------------------------------------------------------------
  // Suite 1: Challenge → Choice unlock → Choice game → Career stats
  // -------------------------------------------------------------------------

  it('baseline — no Choice modes unlocked with empty persistence', async () => {
    const snapshot = await loadAndComputeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(snapshot, loadCodeUnlocks());
    expect(evaluation.totalChoiceModesUnlocked).toBe(0);
    for (const [, status] of evaluation.choiceModes) {
      expect(status.unlocked).toBe(false);
    }
  });

  it('completing 1 challenge unlocks Choice Mode 1 (Revolution) via Track 1', async () => {
    await seedChallengeRecords(1);
    const records = await getAllChallengeRecords();
    expect(records).toHaveLength(1);

    const snapshot = await loadAndComputeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(snapshot, loadCodeUnlocks());

    const revolution = evaluation.choiceModes.get(1);
    expect(revolution).toBeDefined();
    expect(revolution?.registryId).toBe('choice-revolution');
    expect(revolution?.unlockedByProgression).toBe(true);
    expect(revolution?.unlocked).toBe(true);

    // Modes 2-40 should still be locked by progression.
    for (let n = 2; n <= 40; n += 1) {
      expect(evaluation.choiceModes.get(n)?.unlockedByProgression).toBe(false);
    }

    const track1 = evaluation.tracks.find((t) => t.trackId === 'puzzle-mastery');
    expect(track1?.unlockedCount).toBe(1);
    expect(track1?.nextThreshold).toBe(15);
  });

  it('playing a Choice game records a GameRecord and updates Career stats', async () => {
    await seedChallengeRecords(1);

    // Self-play a Choice Revolution game (permanent: KingForADay) to completion.
    const rng = createSeededRandom(7);
    const players = { white: PlayerType.Human, black: PlayerType.CpuHard } as const;
    let state = createNewChoiceGame(
      createAmericanRules(),
      players,
      CrazyEvent.KingForADay,
      rng,
    );

    const boardStates: string[] = [serializeBoard(state.board)];
    const activeEventsPerPly: SerializedActiveEvent[][] = [
      serializeActiveEvents(state.activeEvents),
    ];

    let plies = 0;
    while (state.status === 'IN_PROGRESS' && plies < 200) {
      const legal = getCurrentLegalMoves(state);
      const next = legal[0];
      if (!next) break;
      state = makeMove(state, next);
      boardStates.push(serializeBoard(state.board));
      activeEventsPerPly.push(serializeActiveEvents(state.activeEvents));
      plies += 1;
    }
    expect(state.status).toBe('GAME_OVER');
    expect(state.result).not.toBeNull();

    const gameId = await recordGame(
      state,
      GameMode.Choice,
      Date.now() - 5_000,
      boardStates,
      activeEventsPerPly,
    );
    expect(gameId).toBeTruthy();

    const snapshot = await loadAndComputeCareerSnapshot();
    expect(snapshot.summary.totalGames).toBe(1);

    const modeBlock = snapshot.perMode.get('choice-revolution');
    expect(modeBlock).toBeDefined();
    if (!modeBlock) throw new Error('missing mode block');
    expect(modeBlock.gamesPlayed).toBe(1);

    const totalDecisions = modeBlock.wins + modeBlock.losses + modeBlock.draws;
    expect(totalDecisions).toBe(1);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Suite 2: Multi-track progression
  // -------------------------------------------------------------------------

  it('multi-track: seeding 15 challenges + 3 Crazy Hard wins updates Track 1 and Track 2 together', async () => {
    await seedChallengeRecords(15);

    // Three Crazy wins as Human (White) vs CPU_HARD.
    for (let i = 0; i < 3; i += 1) {
      await seedGameRecord({
        mode: 'CRAZY',
        playerWhite: 'HUMAN',
        playerBlack: 'CPU_HARD',
        result: 'WHITE_WIN',
        reason: 'opponent-eliminated',
      });
    }

    const snapshot = await loadAndComputeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(snapshot, loadCodeUnlocks());

    const track1 = evaluation.tracks.find((t) => t.trackId === 'puzzle-mastery');
    const track2 = evaluation.tracks.find((t) => t.trackId === 'chaos-veteran');
    expect(track1?.unlockedCount).toBe(2);
    expect(track1?.nextThreshold).toBe(29);
    expect(track2?.unlockedCount).toBe(2);
    expect(track2?.nextThreshold).toBe(6);

    expect(evaluation.choiceModes.get(1)?.unlocked).toBe(true); // Revolution
    expect(evaluation.choiceModes.get(2)?.unlocked).toBe(true); // Boom Box
    expect(evaluation.choiceModes.get(9)?.unlocked).toBe(true); // Moonwalk
    expect(evaluation.choiceModes.get(10)?.unlocked).toBe(true); // Fast Lane
    expect(evaluation.choiceModes.get(11)?.unlocked).toBe(false); // Royal Court

    expect(evaluation.totalChoiceModesUnlocked).toBe(4);
  });

  it('Track 4 "play 50 games" milestone flips at exactly 50 recorded games', async () => {
    // Seed 49 games — below the first Track 4 threshold (totalGames >= 50).
    for (let i = 0; i < 49; i += 1) {
      await seedGameRecord({
        mode: 'CLASSIC',
        playerWhite: 'HUMAN',
        playerBlack: 'CPU_EASY',
        result: 'WHITE_WIN',
      });
    }

    let snapshot = await loadAndComputeCareerSnapshot();
    let evaluation = evaluateFullUnlockState(snapshot, loadCodeUnlocks());
    expect(evaluation.choiceModes.get(25)?.unlockedByProgression).toBe(false);

    // Tip over the threshold.
    await seedGameRecord({
      mode: 'CLASSIC',
      playerWhite: 'HUMAN',
      playerBlack: 'CPU_EASY',
      result: 'WHITE_WIN',
    });

    snapshot = await loadAndComputeCareerSnapshot();
    evaluation = evaluateFullUnlockState(snapshot, loadCodeUnlocks());
    expect(snapshot.summary.totalGames).toBe(50);
    expect(evaluation.choiceModes.get(25)?.unlockedByProgression).toBe(true); // Pinball
  });

  // -------------------------------------------------------------------------
  // Suite 3: Choice gallery mirrors unlock state
  // -------------------------------------------------------------------------

  it('Choice gallery registry reflects unlock state from multiple tracks', async () => {
    await seedChallengeRecords(15); // Track 1 → 2 modes (1, 2)
    await seedGameRecord({
      mode: 'CRAZY',
      playerWhite: 'HUMAN',
      playerBlack: 'CPU_HARD',
      result: 'WHITE_WIN',
    }); // Track 2 → 1 mode (9)

    const snapshot = await loadAndComputeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(snapshot, loadCodeUnlocks());

    // Gather unlocked registry IDs per evaluator.
    const unlockedIds = new Set<string>();
    for (const [, status] of evaluation.choiceModes) {
      if (status.unlocked) unlockedIds.add(status.registryId);
    }
    expect(unlockedIds.size).toBe(3);

    // All 40 Choice registry entries resolve; unlocked ones match evaluator.
    const choiceEntries = getModesByCategory('choice');
    expect(choiceEntries.length).toBeGreaterThanOrEqual(40);

    // Each registry entry in unlockedIds is retrievable and marked implemented.
    for (const id of unlockedIds) {
      const entry = getModeOrFallback(id);
      expect(entry.id).toBe(id);
      expect(entry.category).toBe('choice');
    }
  });

  // -------------------------------------------------------------------------
  // Suite 4: In-memory consistency check between computeCareerSnapshot and
  // the async loadAndComputeCareerSnapshot shell.
  // -------------------------------------------------------------------------

  it('loadAndComputeCareerSnapshot matches computeCareerSnapshot over the same records', async () => {
    await seedChallengeRecords(5);
    await seedGameRecord({
      mode: 'CLASSIC',
      playerWhite: 'HUMAN',
      playerBlack: 'CPU_HARD',
      result: 'WHITE_WIN',
    });

    const loaded = await loadAndComputeCareerSnapshot();
    const games = await getAllGameRecords();
    const challenges = await getAllChallengeRecords();
    const recomputed = computeCareerSnapshot(games, challenges);

    expect(loaded.summary.totalGames).toBe(recomputed.summary.totalGames);
    expect(loaded.challengeStats.puzzlesCompleted).toBe(
      recomputed.challengeStats.puzzlesCompleted,
    );
    expect(loaded.tracks.length).toBe(recomputed.tracks.length);
  });
});
