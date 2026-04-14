/**
 * Task 24.1 — cross-feature integration tests.
 *
 * Covers:
 *   1. Code mode unlock immediacy — codes flip evaluator output and
 *      propagate through gameModeRegistry / Career snapshots.
 *   2. Event stacking validation — every implemented event plays a
 *      self-play game in isolation, plus representative pairs and triples.
 */

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../engine/events/index';

import { CrazyEvent, GameMode, PlayerType } from '../engine/types';
import { IMPLEMENTED_EVENTS, META_EVENTS } from '../engine/events';
import { loadAndComputeCareerSnapshot } from '../persistence/careerStatsEngine';
import {
  addCodeUnlock,
  evaluateFullUnlockState,
  loadCodeUnlocks,
  clearCodeUnlocks,
  saveCodeUnlocks,
} from '../persistence/unlockEvaluator';
import {
  appendRedemption,
  loadRedemptionHistory,
  clearRedemptionHistory,
} from '../persistence/redemptionHistory';
import { clearUnlockState } from '../persistence/unlockState';
import {
  clearGameHistory,
  recordGame,
} from '../persistence/gameHistory';
import { clearChallengeHistory } from '../persistence/challengeRecords';
import { getModeOrFallback } from '../persistence/gameModeRegistry';
import { createAmericanRules } from '../engine/rules';
import {
  createNewChoiceGame,
  getCurrentLegalMoves,
  makeMove,
} from '../engine/game';
import {
  serializeActiveEvents,
  serializeBoard,
  type SerializedActiveEvent,
} from '../persistence/serialization';

import { runSelfPlayGame, createSeededRandom } from './testUtils';

async function resetAll(): Promise<void> {
  clearUnlockState();
  clearCodeUnlocks();
  clearRedemptionHistory();
  saveCodeUnlocks(new Set());
  await clearGameHistory();
  await clearChallengeHistory();
}

describe('Task 24.1 — cross-feature: Code unlock immediacy', () => {
  beforeEach(async () => {
    localStorage.clear();
    await resetAll();
  });

  afterEach(async () => {
    localStorage.clear();
    await resetAll();
  });

  it('addCodeUnlock("choice-revolution") flips Choice Mode 1 unlocked flag immediately', async () => {
    const snapshotA = await loadAndComputeCareerSnapshot();
    const before = evaluateFullUnlockState(snapshotA, loadCodeUnlocks());
    expect(before.choiceModes.get(1)?.unlocked).toBe(false);

    const added = addCodeUnlock('choice-revolution');
    expect(added).toBe(true);

    const snapshotB = await loadAndComputeCareerSnapshot();
    const after = evaluateFullUnlockState(snapshotB, loadCodeUnlocks());
    expect(after.choiceModes.get(1)?.unlockedByCode).toBe(true);
    expect(after.choiceModes.get(1)?.unlocked).toBe(true);

    const entry = getModeOrFallback('choice-revolution');
    expect(entry.id).toBe('choice-revolution');
    expect(entry.category).toBe('choice');
    expect(entry.implemented).toBe(true);
  });

  it('addCodeUnlock("chaos") flips Chaos Gate immediately', async () => {
    const evalBefore = evaluateFullUnlockState(
      await loadAndComputeCareerSnapshot(),
      loadCodeUnlocks(),
    );
    expect(evalBefore.chaosGate.unlocked).toBe(false);
    expect(evalBefore.chaosGate.unlockedByCode).toBe(false);

    expect(addCodeUnlock('chaos')).toBe(true);

    const evalAfter = evaluateFullUnlockState(
      await loadAndComputeCareerSnapshot(),
      loadCodeUnlocks(),
    );
    expect(evalAfter.chaosGate.unlocked).toBe(true);
    expect(evalAfter.chaosGate.unlockedByCode).toBe(true);
    expect(evalAfter.snapshot.chaosUnlocked).toBe(true);
  });

  it('addCodeUnlock("all") acts as master unlock across Choice + Chaos', async () => {
    expect(addCodeUnlock('all')).toBe(true);
    const evaluation = evaluateFullUnlockState(
      await loadAndComputeCareerSnapshot(),
      loadCodeUnlocks(),
    );
    expect(evaluation.masterUnlockActive).toBe(true);
    expect(evaluation.totalChoiceModesUnlocked).toBe(40);
    expect(evaluation.chaosGate.unlocked).toBe(true);
  });

  it('duplicate addCodeUnlock returns false without corrupting state', () => {
    expect(addCodeUnlock('choice-revolution')).toBe(true);
    expect(addCodeUnlock('choice-revolution')).toBe(false);
    const unlocks = loadCodeUnlocks();
    expect(unlocks.has('choice-revolution')).toBe(true);
    expect(unlocks.size).toBe(1);
  });

  it('a code-unlocked Choice game is counted in Career perMode', async () => {
    addCodeUnlock('choice-revolution');

    const rng = createSeededRandom(11);
    let state = createNewChoiceGame(
      createAmericanRules(),
      { white: PlayerType.Human, black: PlayerType.CpuHard },
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
    await recordGame(
      state,
      GameMode.Choice,
      Date.now() - 2_000,
      boardStates,
      activeEventsPerPly,
    );

    const snapshot = await loadAndComputeCareerSnapshot();
    const block = snapshot.perMode.get('choice-revolution');
    expect(block?.gamesPlayed).toBe(1);
    expect(snapshot.summary.totalGames).toBe(1);
  }, 60_000);

  it('redemption history entries persist across reloads (in-memory)', () => {
    appendRedemption({
      code: 'CHAOS',
      description: 'Chaos mode',
      newUnlocksCount: 1,
      timestamp: 1_700_000_000_000,
    });
    appendRedemption({
      code: 'REVOLUTION',
      description: 'Choice Mode: Revolution',
      newUnlocksCount: 1,
      timestamp: 1_700_000_100_000,
    });
    const history = loadRedemptionHistory();
    expect(history).toHaveLength(2);
    expect(history.map((h) => h.code)).toEqual(['CHAOS', 'REVOLUTION']);
  });
});

// ---------------------------------------------------------------------------
// Event stacking validation
// ---------------------------------------------------------------------------

const STACKING_PLY_LIMIT = 150;
const SELF_PLAY_SEED = 4242;

/** Events to stack-test: implemented events minus meta-events. */
const STACKABLE_EVENTS: readonly CrazyEvent[] = IMPLEMENTED_EVENTS.filter(
  (e) => !META_EVENTS.includes(e),
);

/** Representative pairs chosen from across tiers and known conflict zones. */
const PAIR_CASES: ReadonlyArray<readonly [CrazyEvent, CrazyEvent]> = [
  [CrazyEvent.KingForADay, CrazyEvent.LiveGrenade],
  [CrazyEvent.OppositeDay, CrazyEvent.FlippedScript],
  [CrazyEvent.FrozenAssets, CrazyEvent.Quicksand],
  [CrazyEvent.Reinforcements, CrazyEvent.ShrinkingBoard],
  [CrazyEvent.Leapfrog, CrazyEvent.GhostWalk],
  [CrazyEvent.MarchingOrders, CrazyEvent.ForcedMarch],
  [CrazyEvent.SafeHaven, CrazyEvent.Landmine],
  [CrazyEvent.CrownThief, CrazyEvent.KingForADay],
  [CrazyEvent.Wormhole, CrazyEvent.ShrinkingBoard],
  [CrazyEvent.Backfire, CrazyEvent.ChainReaction],
];

/** Representative triples targeting high-conflict interaction zones. */
const TRIPLE_CASES: ReadonlyArray<readonly [CrazyEvent, CrazyEvent, CrazyEvent]> = [
  [CrazyEvent.OppositeDay, CrazyEvent.FlippedScript, CrazyEvent.MarchingOrders],
  [CrazyEvent.FrozenAssets, CrazyEvent.Quicksand, CrazyEvent.SafeHaven],
  [CrazyEvent.CrownThief, CrazyEvent.KingForADay, CrazyEvent.Demotion],
  [CrazyEvent.Reinforcements, CrazyEvent.ShrinkingBoard, CrazyEvent.Conscription],
  [CrazyEvent.Leapfrog, CrazyEvent.GhostWalk, CrazyEvent.Backfire],
];

describe('Task 24.1 — event stacking validation', () => {
  it.each(STACKABLE_EVENTS)(
    'single event %s runs a self-play game without errors',
    (event) => {
      const result = runSelfPlayGame({
        mode: GameMode.Crazy,
        permanentEvents: [event],
        maxPlies: STACKING_PLY_LIMIT,
        seed: SELF_PLAY_SEED,
      });
      expect(result.error).toBeNull();
      expect(result.finalState.board.length).toBe(32);
      // Either the game completed naturally or hit the ply limit gracefully.
      expect(result.plies).toBeGreaterThan(0);
    },
    30_000,
  );

  it.each(PAIR_CASES)(
    'paired events [%s, %s] run a self-play game without errors',
    (a, b) => {
      const result = runSelfPlayGame({
        mode: GameMode.Crazy,
        permanentEvents: [a, b],
        maxPlies: STACKING_PLY_LIMIT,
        seed: SELF_PLAY_SEED,
      });
      expect(result.error).toBeNull();
      expect(result.finalState.board.length).toBe(32);
      expect(result.plies).toBeGreaterThan(0);
    },
    45_000,
  );

  it.each(TRIPLE_CASES)(
    'triple events [%s, %s, %s] run a self-play game without errors',
    (a, b, c) => {
      const result = runSelfPlayGame({
        mode: GameMode.Crazy,
        permanentEvents: [a, b, c],
        maxPlies: STACKING_PLY_LIMIT,
        seed: SELF_PLAY_SEED,
      });
      expect(result.error).toBeNull();
      expect(result.finalState.board.length).toBe(32);
      expect(result.plies).toBeGreaterThan(0);
    },
    60_000,
  );
});
