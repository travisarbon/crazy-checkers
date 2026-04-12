import { describe, it, expect } from 'vitest';
import { CrazyEvent } from '../engine/types';
import type { GameRecord } from './gameHistory';
import type { ChallengeRecord } from './challengeRecords';
import {
  classifyGameRecord,
  computeStreaks,
  computeCareerSnapshot,
  updateCareerSnapshot,
  formatPlayTime,
  type GameClassification,
} from './careerStatsEngine';

// ---------------------------------------------------------------------------
// Test fixture factories
// ---------------------------------------------------------------------------

let recordCounter = 0;

function makeGameRecord(overrides: Partial<GameRecord> = {}): GameRecord {
  recordCounter += 1;
  return {
    id: `test-record-${String(recordCounter)}`,
    mode: 'CLASSIC',
    playerWhite: 'HUMAN',
    playerBlack: 'CPU_EASY',
    result: 'WHITE_WIN',
    reason: 'NO_PIECES_LEFT',
    moves: ['1-5', '10-14', '5-9'],
    boardStates: ['...'],
    startedAt: 1000000 + (recordCounter - 1) * 300000,
    completedAt: 1000000 + recordCounter * 300000,
    ...overrides,
  };
}

function makeChallengeRecord(
  overrides: Partial<ChallengeRecord> & { puzzleId: number },
): ChallengeRecord {
  recordCounter += 1;
  return {
    id: `test-challenge-${String(recordCounter)}`,
    solved: false,
    solveTimeMs: 0,
    rating: 0,
    movesPlayed: [],
    attemptNumber: 1,
    completedAt: Date.now(),
    ...overrides,
  };
}

/** Creates a classification directly for streak tests. */
function makeClassification(
  overrides: Partial<GameClassification> = {},
): GameClassification {
  return {
    registryEntry: {
      id: 'classic',
      displayName: 'Classic',
      category: 'classic',
      wave: null,
      family: null,
      tracksContribution: [],
      excludeFromCareer: false,
      unlockRequirement: null,
      engineMode: 'CLASSIC',
      permanentEvent: null,
      choiceDescription: null,
      choiceNumber: null,
      classifiedIndex: null,
      boardGeometry: null,
      implemented: true,
    },
    isPassAround: false,
    isCpuGame: true,
    cpuDifficulty: 'easy',
    humanColor: 'white',
    humanWon: true,
    humanLost: false,
    isDraw: false,
    playTimeMs: 300000,
    gameLengthPlies: 30,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. classifyGameRecord tests
// ---------------------------------------------------------------------------

describe('classifyGameRecord', () => {
  it('classifies human-as-White win vs Easy', () => {
    const r = makeGameRecord({
      playerWhite: 'HUMAN',
      playerBlack: 'CPU_EASY',
      result: 'WHITE_WIN',
    });
    const c = classifyGameRecord(r);
    expect(c.humanWon).toBe(true);
    expect(c.humanLost).toBe(false);
    expect(c.isDraw).toBe(false);
    expect(c.cpuDifficulty).toBe('easy');
    expect(c.humanColor).toBe('white');
    expect(c.isCpuGame).toBe(true);
    expect(c.isPassAround).toBe(false);
  });

  it('classifies human-as-Black win vs Hard', () => {
    const r = makeGameRecord({
      playerWhite: 'CPU_HARD',
      playerBlack: 'HUMAN',
      result: 'BLACK_WIN',
    });
    const c = classifyGameRecord(r);
    expect(c.humanWon).toBe(true);
    expect(c.humanLost).toBe(false);
    expect(c.cpuDifficulty).toBe('hard');
    expect(c.humanColor).toBe('black');
  });

  it('classifies human loss as White', () => {
    const r = makeGameRecord({
      playerWhite: 'HUMAN',
      playerBlack: 'CPU_HARD',
      result: 'BLACK_WIN',
    });
    const c = classifyGameRecord(r);
    expect(c.humanWon).toBe(false);
    expect(c.humanLost).toBe(true);
  });

  it('classifies draw vs CPU', () => {
    const r = makeGameRecord({
      playerWhite: 'HUMAN',
      playerBlack: 'CPU_HARD',
      result: 'DRAW',
    });
    const c = classifyGameRecord(r);
    expect(c.isDraw).toBe(true);
    expect(c.humanWon).toBe(false);
    expect(c.humanLost).toBe(false);
  });

  it('classifies Pass Around game', () => {
    const r = makeGameRecord({
      playerWhite: 'HUMAN',
      playerBlack: 'HUMAN',
      result: 'WHITE_WIN',
    });
    const c = classifyGameRecord(r);
    expect(c.isPassAround).toBe(true);
    expect(c.isCpuGame).toBe(false);
    expect(c.humanColor).toBeNull();
    expect(c.cpuDifficulty).toBeNull();
    // In pass around, humanWon/humanLost are always false
    expect(c.humanWon).toBe(false);
    expect(c.humanLost).toBe(false);
  });

  it('classifies Pass Around draw', () => {
    const r = makeGameRecord({
      playerWhite: 'HUMAN',
      playerBlack: 'HUMAN',
      result: 'DRAW',
    });
    const c = classifyGameRecord(r);
    expect(c.isPassAround).toBe(true);
    expect(c.isDraw).toBe(true);
  });

  it('clamps negative play time to 0', () => {
    const r = makeGameRecord({
      startedAt: 1000,
      completedAt: 500,
    });
    const c = classifyGameRecord(r);
    expect(c.playTimeMs).toBe(0);
  });

  it('computes game length from moves array', () => {
    const r = makeGameRecord({
      moves: ['1-5', '10-14', '5-9', '14-18', '9-13'],
    });
    const c = classifyGameRecord(r);
    expect(c.gameLengthPlies).toBe(5);
  });

  it('resolves Choice mode with activeEventsPerPly', () => {
    const r = makeGameRecord({
      mode: 'CHOICE',
      activeEventsPerPly: [
        [
          {
            type: 'KING_FOR_A_DAY',
            remainingPlies: -1,
            triggeredBy: 'WHITE',
            triggeredAtPly: 0,
          },
        ],
      ],
    });
    const c = classifyGameRecord(r);
    expect(c.registryEntry.id).toBe('choice-revolution');
    expect(c.registryEntry.excludeFromCareer).toBe(false);
  });

  it('resolves unknown mode to fallback (excluded from career)', () => {
    const r = makeGameRecord({ mode: 'UNKNOWN_MODE' });
    const c = classifyGameRecord(r);
    expect(c.registryEntry.id).toBe('unknown');
    expect(c.registryEntry.excludeFromCareer).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. computeStreaks tests
// ---------------------------------------------------------------------------

describe('computeStreaks', () => {
  it('returns all zeros for empty array', () => {
    const result = computeStreaks([]);
    expect(result.longestWinStreak).toBe(0);
    expect(result.currentWinStreak).toBe(0);
    expect(result.longestHardWinStreak).toBe(0);
    expect(result.currentHardWinStreak).toBe(0);
  });

  it('tracks single win', () => {
    const result = computeStreaks([makeClassification({ humanWon: true })]);
    expect(result.longestWinStreak).toBe(1);
    expect(result.currentWinStreak).toBe(1);
  });

  it('tracks W-L-W-W pattern', () => {
    const result = computeStreaks([
      makeClassification({ humanWon: true, humanLost: false }),
      makeClassification({ humanWon: false, humanLost: true }),
      makeClassification({ humanWon: true, humanLost: false }),
      makeClassification({ humanWon: true, humanLost: false }),
    ]);
    expect(result.longestWinStreak).toBe(2);
    expect(result.currentWinStreak).toBe(2);
  });

  it('tracks W-W-L pattern', () => {
    const result = computeStreaks([
      makeClassification({ humanWon: true, humanLost: false }),
      makeClassification({ humanWon: true, humanLost: false }),
      makeClassification({ humanWon: false, humanLost: true }),
    ]);
    expect(result.longestWinStreak).toBe(2);
    expect(result.currentWinStreak).toBe(0);
  });

  it('draw resets streak', () => {
    const result = computeStreaks([
      makeClassification({ humanWon: true, humanLost: false, isDraw: false }),
      makeClassification({ humanWon: true, humanLost: false, isDraw: false }),
      makeClassification({ humanWon: false, humanLost: false, isDraw: true }),
      makeClassification({ humanWon: true, humanLost: false, isDraw: false }),
    ]);
    expect(result.longestWinStreak).toBe(2);
    expect(result.currentWinStreak).toBe(1);
  });

  it('skips Pass Around games', () => {
    const result = computeStreaks([
      makeClassification({ humanWon: true }),
      makeClassification({ isPassAround: true, humanWon: false, humanLost: false }),
      makeClassification({ isPassAround: true, humanWon: false, humanLost: false }),
      makeClassification({ humanWon: true }),
    ]);
    expect(result.longestWinStreak).toBe(2);
    expect(result.currentWinStreak).toBe(2);
  });

  it('only Pass Around games returns all zeros', () => {
    const result = computeStreaks([
      makeClassification({ isPassAround: true, humanWon: false }),
      makeClassification({ isPassAround: true, humanWon: false }),
      makeClassification({ isPassAround: true, humanWon: false }),
    ]);
    expect(result.longestWinStreak).toBe(0);
    expect(result.currentWinStreak).toBe(0);
  });

  it('tracks Hard win streak separately', () => {
    const result = computeStreaks([
      makeClassification({ humanWon: true, cpuDifficulty: 'easy' }),
      makeClassification({ humanWon: true, cpuDifficulty: 'hard' }),
      makeClassification({ humanWon: false, humanLost: true, cpuDifficulty: 'easy' }),
      makeClassification({ humanWon: true, cpuDifficulty: 'hard' }),
      makeClassification({ humanWon: true, cpuDifficulty: 'hard' }),
    ]);
    // Hard streak only resets on hard game losses; easy losses don't affect it
    // W(Hard), W(Hard), W(Hard) => longest=3, current=3
    expect(result.longestHardWinStreak).toBe(3);
    expect(result.currentHardWinStreak).toBe(3);
    // General streak: W, W, L, W, W => longest=2, current=2
    expect(result.longestWinStreak).toBe(2);
    expect(result.currentWinStreak).toBe(2);
  });

  it('ten-game win streak', () => {
    const classifications = Array.from({ length: 10 }, () =>
      makeClassification({ humanWon: true }),
    );
    const result = computeStreaks(classifications);
    expect(result.longestWinStreak).toBe(10);
    expect(result.currentWinStreak).toBe(10);
  });

  it('Hard loss resets only hard streak', () => {
    const result = computeStreaks([
      makeClassification({ humanWon: true, cpuDifficulty: 'hard' }),
      makeClassification({ humanWon: true, cpuDifficulty: 'hard' }),
      makeClassification({ humanWon: false, humanLost: true, cpuDifficulty: 'hard' }),
      makeClassification({ humanWon: true, cpuDifficulty: 'easy' }),
    ]);
    expect(result.longestHardWinStreak).toBe(2);
    expect(result.currentHardWinStreak).toBe(0);
    expect(result.currentWinStreak).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3. computeCareerSnapshot — Summary tests
// ---------------------------------------------------------------------------

describe('computeCareerSnapshot — Summary', () => {
  it('returns empty stats for empty record set', () => {
    const snapshot = computeCareerSnapshot([]);
    expect(snapshot.summary.totalGames).toBe(0);
    expect(snapshot.summary.wins).toBe(0);
    expect(snapshot.summary.losses).toBe(0);
    expect(snapshot.summary.draws).toBe(0);
    expect(snapshot.summary.winRate).toBe(0);
    expect(snapshot.summary.longestWinStreak).toBe(0);
    expect(snapshot.summary.currentWinStreak).toBe(0);
    expect(snapshot.summary.totalPlayTimeMs).toBe(0);
    expect(snapshot.summary.averageGameLengthPlies).toBe(0);
    expect(snapshot.summary.averagePlayTimeMs).toBe(0);
  });

  it('computes single Classic win correctly', () => {
    const records = [
      makeGameRecord({
        playerWhite: 'HUMAN',
        playerBlack: 'CPU_EASY',
        result: 'WHITE_WIN',
        startedAt: 0,
        completedAt: 300000,
      }),
    ];
    const snapshot = computeCareerSnapshot(records);
    expect(snapshot.summary.totalGames).toBe(1);
    expect(snapshot.summary.wins).toBe(1);
    expect(snapshot.summary.losses).toBe(0);
    expect(snapshot.summary.draws).toBe(0);
    expect(snapshot.summary.winRate).toBe(100);
  });

  it('computes mixed outcomes: 3W, 2L, 1D', () => {
    const records = [
      makeGameRecord({ result: 'WHITE_WIN', completedAt: 1 }),
      makeGameRecord({ result: 'WHITE_WIN', completedAt: 2 }),
      makeGameRecord({ result: 'WHITE_WIN', completedAt: 3 }),
      makeGameRecord({ result: 'BLACK_WIN', completedAt: 4 }),
      makeGameRecord({ result: 'BLACK_WIN', completedAt: 5 }),
      makeGameRecord({ result: 'DRAW', completedAt: 6 }),
    ];
    const snapshot = computeCareerSnapshot(records);
    expect(snapshot.summary.totalGames).toBe(6);
    expect(snapshot.summary.wins).toBe(3);
    expect(snapshot.summary.losses).toBe(2);
    expect(snapshot.summary.draws).toBe(1);
    expect(snapshot.summary.winRate).toBe(60);
  });

  it('aggregates play time correctly', () => {
    const records = [
      makeGameRecord({ startedAt: 0, completedAt: 300000 }),
      makeGameRecord({ startedAt: 300000, completedAt: 600000 }),
      makeGameRecord({ startedAt: 600000, completedAt: 900000 }),
    ];
    const snapshot = computeCareerSnapshot(records);
    expect(snapshot.summary.totalPlayTimeMs).toBe(900000);
    expect(snapshot.summary.averagePlayTimeMs).toBe(300000);
  });

  it('excludes Free Play games', () => {
    const records = [
      makeGameRecord({ mode: 'CLASSIC', completedAt: 1 }),
      makeGameRecord({ mode: 'CLASSIC', completedAt: 2 }),
      makeGameRecord({ mode: 'CLASSIC', completedAt: 3 }),
      makeGameRecord({ mode: 'CLASSIC', completedAt: 4 }),
      makeGameRecord({ mode: 'CLASSIC', completedAt: 5 }),
      // Free Play games stored as 'free-play' mode resolved to excludeFromCareer: true
      // But mode in GameRecord is the engine mode string. Free Play uses 'free-play' as its mode.
      // Actually looking at the registry: id is 'free-play', engineMode is 'CLASSIC'
      // Records for free play would have mode set by the game system. Let's test with
      // direct registry resolution. The mode string in GameRecord goes through
      // resolveGameRecord which maps lowercase to the registry.
      makeGameRecord({ mode: 'free-play', completedAt: 6 }),
      makeGameRecord({ mode: 'free-play', completedAt: 7 }),
      makeGameRecord({ mode: 'free-play', completedAt: 8 }),
    ];
    const snapshot = computeCareerSnapshot(records);
    expect(snapshot.summary.totalGames).toBe(5);
  });

  it('computes average game length', () => {
    const records = [
      makeGameRecord({
        moves: Array.from({ length: 20 }, () => '1-5'),
        completedAt: 1,
      }),
      makeGameRecord({
        moves: Array.from({ length: 30 }, () => '1-5'),
        completedAt: 2,
      }),
      makeGameRecord({
        moves: Array.from({ length: 40 }, () => '1-5'),
        completedAt: 3,
      }),
    ];
    const snapshot = computeCareerSnapshot(records);
    expect(snapshot.summary.averageGameLengthPlies).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// 4. computeCareerSnapshot — Per-Opponent tests
// ---------------------------------------------------------------------------

describe('computeCareerSnapshot — PerOpponent', () => {
  it('breaks down vs Easy stats', () => {
    const records = [
      makeGameRecord({ playerBlack: 'CPU_EASY', result: 'WHITE_WIN', completedAt: 1 }),
      makeGameRecord({ playerBlack: 'CPU_EASY', result: 'WHITE_WIN', completedAt: 2 }),
      makeGameRecord({ playerBlack: 'CPU_EASY', result: 'BLACK_WIN', completedAt: 3 }),
    ];
    const snapshot = computeCareerSnapshot(records);
    expect(snapshot.perOpponent.vsEasy.gamesPlayed).toBe(3);
    expect(snapshot.perOpponent.vsEasy.wins).toBe(2);
    expect(snapshot.perOpponent.vsEasy.losses).toBe(1);
    expect(snapshot.perOpponent.vsEasy.winRate).toBeCloseTo(66.6667, 2);
  });

  it('breaks down vs Hard stats', () => {
    const records = [
      makeGameRecord({ playerBlack: 'CPU_HARD', result: 'WHITE_WIN', completedAt: 1 }),
      makeGameRecord({ playerBlack: 'CPU_HARD', result: 'BLACK_WIN', completedAt: 2 }),
      makeGameRecord({ playerBlack: 'CPU_HARD', result: 'BLACK_WIN', completedAt: 3 }),
      makeGameRecord({ playerBlack: 'CPU_HARD', result: 'DRAW', completedAt: 4 }),
    ];
    const snapshot = computeCareerSnapshot(records);
    expect(snapshot.perOpponent.vsHard.gamesPlayed).toBe(4);
    expect(snapshot.perOpponent.vsHard.wins).toBe(1);
    expect(snapshot.perOpponent.vsHard.losses).toBe(2);
    expect(snapshot.perOpponent.vsHard.draws).toBe(1);
  });

  it('breaks down Pass Around stats', () => {
    const records = [
      makeGameRecord({ playerWhite: 'HUMAN', playerBlack: 'HUMAN', result: 'WHITE_WIN', completedAt: 1 }),
      makeGameRecord({ playerWhite: 'HUMAN', playerBlack: 'HUMAN', result: 'WHITE_WIN', completedAt: 2 }),
      makeGameRecord({ playerWhite: 'HUMAN', playerBlack: 'HUMAN', result: 'DRAW', completedAt: 3 }),
    ];
    const snapshot = computeCareerSnapshot(records);
    expect(snapshot.perOpponent.passAround.gamesPlayed).toBe(3);
    expect(snapshot.perOpponent.passAround.whiteWins).toBe(2);
    expect(snapshot.perOpponent.passAround.blackWins).toBe(0);
    expect(snapshot.perOpponent.passAround.draws).toBe(1);
  });

  it('Pass Around games do not count in vs-CPU W/L/D', () => {
    const records = [
      makeGameRecord({ playerBlack: 'CPU_EASY', result: 'WHITE_WIN', completedAt: 1 }),
      makeGameRecord({ playerWhite: 'HUMAN', playerBlack: 'HUMAN', result: 'WHITE_WIN', completedAt: 2 }),
      makeGameRecord({ playerWhite: 'HUMAN', playerBlack: 'HUMAN', result: 'BLACK_WIN', completedAt: 3 }),
    ];
    const snapshot = computeCareerSnapshot(records);
    expect(snapshot.summary.wins).toBe(1);
    expect(snapshot.summary.losses).toBe(0);
    expect(snapshot.summary.totalGames).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 5. computeCareerSnapshot — Per-Mode tests
// ---------------------------------------------------------------------------

describe('computeCareerSnapshot — PerMode', () => {
  it('tracks Classic mode stats', () => {
    const records = [
      makeGameRecord({ mode: 'CLASSIC', result: 'WHITE_WIN', completedAt: 1 }),
      makeGameRecord({ mode: 'CLASSIC', result: 'WHITE_WIN', completedAt: 2 }),
      makeGameRecord({ mode: 'CLASSIC', result: 'BLACK_WIN', completedAt: 3 }),
      makeGameRecord({ mode: 'CLASSIC', result: 'DRAW', completedAt: 4 }),
      makeGameRecord({ mode: 'CLASSIC', result: 'WHITE_WIN', completedAt: 5 }),
    ];
    const snapshot = computeCareerSnapshot(records);
    const classic = snapshot.perMode.get('classic');
    expect(classic).toBeDefined();
    expect(classic?.gamesPlayed).toBe(5);
    expect(classic?.wins).toBe(3);
    expect(classic?.losses).toBe(1);
    expect(classic?.draws).toBe(1);
  });

  it('tracks Crazy mode stats', () => {
    const records = [
      makeGameRecord({ mode: 'CRAZY', result: 'WHITE_WIN', completedAt: 1 }),
      makeGameRecord({ mode: 'CRAZY', result: 'BLACK_WIN', completedAt: 2 }),
      makeGameRecord({ mode: 'CRAZY', result: 'WHITE_WIN', completedAt: 3 }),
    ];
    const snapshot = computeCareerSnapshot(records);
    const crazy = snapshot.perMode.get('crazy');
    expect(crazy).toBeDefined();
    expect(crazy?.gamesPlayed).toBe(3);
    expect(crazy?.wins).toBe(2);
    expect(crazy?.losses).toBe(1);
  });

  it('tracks per-variant Choice mode stats', () => {
    const records = [
      makeGameRecord({
        mode: 'CHOICE',
        result: 'WHITE_WIN',
        completedAt: 1,
        activeEventsPerPly: [
          [{ type: 'KING_FOR_A_DAY', remainingPlies: -1, triggeredBy: 'WHITE', triggeredAtPly: 0 }],
        ],
      }),
      makeGameRecord({
        mode: 'CHOICE',
        result: 'WHITE_WIN',
        completedAt: 2,
        activeEventsPerPly: [
          [{ type: 'KING_FOR_A_DAY', remainingPlies: -1, triggeredBy: 'WHITE', triggeredAtPly: 0 }],
        ],
      }),
      makeGameRecord({
        mode: 'CHOICE',
        result: 'WHITE_WIN',
        completedAt: 3,
        activeEventsPerPly: [
          [{ type: 'LIVE_GRENADE', remainingPlies: -1, triggeredBy: 'WHITE', triggeredAtPly: 0 }],
        ],
      }),
    ];
    const snapshot = computeCareerSnapshot(records);
    const revolution = snapshot.perMode.get('choice-revolution');
    expect(revolution).toBeDefined();
    expect(revolution?.gamesPlayed).toBe(2);
    const boomBox = snapshot.perMode.get('choice-boom-box');
    expect(boomBox).toBeDefined();
    expect(boomBox?.gamesPlayed).toBe(1);
  });

  it('aggregates multiple modes independently', () => {
    const records = [
      makeGameRecord({ mode: 'CLASSIC', result: 'WHITE_WIN', completedAt: 1 }),
      makeGameRecord({ mode: 'CRAZY', result: 'BLACK_WIN', completedAt: 2 }),
      makeGameRecord({
        mode: 'CHOICE',
        result: 'WHITE_WIN',
        completedAt: 3,
        activeEventsPerPly: [
          [{ type: 'KING_FOR_A_DAY', remainingPlies: -1, triggeredBy: 'WHITE', triggeredAtPly: 0 }],
        ],
      }),
    ];
    const snapshot = computeCareerSnapshot(records);
    expect(snapshot.perMode.get('classic')?.wins).toBe(1);
    expect(snapshot.perMode.get('crazy')?.losses).toBe(1);
    expect(snapshot.perMode.get('choice-revolution')?.wins).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 6. Track 4 Milestone tests
// ---------------------------------------------------------------------------

describe('computeCareerSnapshot — Track 4 Milestones', () => {
  it('no milestones met with 10 games', () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      makeGameRecord({ completedAt: i + 1 }),
    );
    const snapshot = computeCareerSnapshot(records);
    // Milestone #25 requires 50 games
    expect(snapshot.track4Milestones[0]?.met).toBe(false);
    expect(snapshot.track4Milestones[0]?.currentValue).toBe(10);
  });

  it('50 games milestone met', () => {
    const records = Array.from({ length: 50 }, (_, i) =>
      makeGameRecord({ completedAt: i + 1 }),
    );
    const snapshot = computeCareerSnapshot(records);
    expect(snapshot.track4Milestones[0]?.met).toBe(true);
    expect(snapshot.track4Milestones[0]?.currentValue).toBe(50);
  });

  it('5-game Hard streak milestone', () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      makeGameRecord({
        playerBlack: 'CPU_HARD',
        result: 'WHITE_WIN',
        completedAt: i + 1,
      }),
    );
    const snapshot = computeCareerSnapshot(records);
    // Milestone #26: Win 5 in a row vs Hard
    expect(snapshot.track4Milestones[1]?.met).toBe(true);
  });

  it('10 Black Hard wins milestone', () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      makeGameRecord({
        playerWhite: 'CPU_HARD',
        playerBlack: 'HUMAN',
        result: 'BLACK_WIN',
        completedAt: i + 1,
      }),
    );
    const snapshot = computeCareerSnapshot(records);
    // Milestone #27: Win 10 games as Black vs Hard
    expect(snapshot.track4Milestones[2]?.met).toBe(true);
    expect(snapshot.track4Milestones[2]?.currentValue).toBe(10);
  });

  it('5 distinct mode wins milestone', () => {
    const records = [
      makeGameRecord({ mode: 'CLASSIC', result: 'WHITE_WIN', completedAt: 1 }),
      makeGameRecord({ mode: 'CRAZY', result: 'WHITE_WIN', completedAt: 2 }),
      makeGameRecord({
        mode: 'CHOICE', result: 'WHITE_WIN', completedAt: 3,
        activeEventsPerPly: [[{ type: 'KING_FOR_A_DAY', remainingPlies: -1, triggeredBy: 'WHITE', triggeredAtPly: 0 }]],
      }),
      makeGameRecord({
        mode: 'CHOICE', result: 'WHITE_WIN', completedAt: 4,
        activeEventsPerPly: [[{ type: 'LIVE_GRENADE', remainingPlies: -1, triggeredBy: 'WHITE', triggeredAtPly: 0 }]],
      }),
      makeGameRecord({
        mode: 'CHOICE', result: 'WHITE_WIN', completedAt: 5,
        activeEventsPerPly: [[{ type: 'HOT_POTATO', remainingPlies: -1, triggeredBy: 'WHITE', triggeredAtPly: 0 }]],
      }),
    ];
    const snapshot = computeCareerSnapshot(records);
    // Milestone #29: Win a game in 5 different modes
    expect(snapshot.track4Milestones[4]?.met).toBe(true);
    expect(snapshot.track4Milestones[4]?.currentValue).toBe(5);
  });

  it('25 Pass Around games milestone', () => {
    const records = Array.from({ length: 25 }, (_, i) =>
      makeGameRecord({
        playerWhite: 'HUMAN',
        playerBlack: 'HUMAN',
        result: 'WHITE_WIN',
        completedAt: i + 1,
      }),
    );
    const snapshot = computeCareerSnapshot(records);
    // Milestone #30: Win 25 games in Pass Around (counts completed games)
    expect(snapshot.track4Milestones[5]?.met).toBe(true);
  });

  it('partial progress shows correct values', () => {
    const records = Array.from({ length: 45 }, (_, i) =>
      makeGameRecord({ completedAt: i + 1 }),
    );
    const snapshot = computeCareerSnapshot(records);
    // Milestone #25: 50 games — not met yet
    expect(snapshot.track4Milestones[0]?.currentValue).toBe(45);
    expect(snapshot.track4Milestones[0]?.met).toBe(false);
    expect(snapshot.track4Milestones[0]?.requiredValue).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// 7. Track Progress tests
// ---------------------------------------------------------------------------

describe('computeCareerSnapshot — Track Progress', () => {
  it('Track 2 — zero Crazy Hard wins', () => {
    const snapshot = computeCareerSnapshot([]);
    const track2 = snapshot.tracks[1];
    expect(track2?.currentValue).toBe(0);
    expect(track2?.completedMilestones).toBe(0);
    expect(track2?.nextThreshold).toBe(1);
  });

  it('Track 2 — 6 Crazy Hard wins', () => {
    const records = Array.from({ length: 6 }, (_, i) =>
      makeGameRecord({
        mode: 'CRAZY',
        playerBlack: 'CPU_HARD',
        result: 'WHITE_WIN',
        completedAt: i + 1,
      }),
    );
    const snapshot = computeCareerSnapshot(records);
    const track2 = snapshot.tracks[1];
    expect(track2?.currentValue).toBe(6);
    // Thresholds: [1, 3, 6, 10, ...] — 6 meets 3 thresholds
    expect(track2?.completedMilestones).toBe(3);
    expect(track2?.nextThreshold).toBe(10);
  });

  it('Track 3 — 1 Choice Hard win', () => {
    const records = [
      makeGameRecord({
        mode: 'CHOICE',
        playerBlack: 'CPU_HARD',
        result: 'WHITE_WIN',
        completedAt: 1,
        activeEventsPerPly: [
          [{ type: 'KING_FOR_A_DAY', remainingPlies: -1, triggeredBy: 'WHITE', triggeredAtPly: 0 }],
        ],
      }),
    ];
    const snapshot = computeCareerSnapshot(records);
    const track3 = snapshot.tracks[2];
    expect(track3?.currentValue).toBe(1);
    expect(track3?.completedMilestones).toBe(1);
    expect(track3?.nextThreshold).toBe(4);
  });

  it('Track 5 — duplicate wins dont double count', () => {
    // Same classified game won 5 times — should count as 1 distinct win
    const records = Array.from({ length: 5 }, (_, i) =>
      makeGameRecord({
        mode: 'classified-1',
        playerBlack: 'CPU_HARD',
        result: 'WHITE_WIN',
        completedAt: i + 1,
      }),
    );
    const snapshot = computeCareerSnapshot(records);
    const track5 = snapshot.tracks[4];
    expect(track5?.currentValue).toBe(1);
  });

  it('Track 1 — puzzle mastery with challenge records', () => {
    const challengeRecords = [
      makeChallengeRecord({ puzzleId: 1, solved: true, solveTimeMs: 5000, rating: 3, attemptNumber: 1 }),
      makeChallengeRecord({ puzzleId: 2, solved: true, solveTimeMs: 6000, rating: 2, attemptNumber: 1 }),
    ];
    const snapshot = computeCareerSnapshot([], challengeRecords);
    const track1 = snapshot.tracks[0];
    expect(track1?.currentValue).toBe(2);
    expect(track1?.completedMilestones).toBe(1); // Threshold 1 met, not 15
    expect(track1?.nextThreshold).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// 8. Incremental Update tests
// ---------------------------------------------------------------------------

describe('updateCareerSnapshot', () => {
  it('incremental matches full recompute for basic scenario', () => {
    const baseRecords = [
      makeGameRecord({ result: 'WHITE_WIN', completedAt: 1 }),
      makeGameRecord({ result: 'BLACK_WIN', completedAt: 2 }),
      makeGameRecord({ result: 'WHITE_WIN', completedAt: 3 }),
    ];
    const baseSnapshot = computeCareerSnapshot(baseRecords);

    const newRecord = makeGameRecord({ result: 'WHITE_WIN', completedAt: 4 });
    const incrementalSnapshot = updateCareerSnapshot(baseSnapshot, newRecord);
    const fullSnapshot = computeCareerSnapshot([...baseRecords, newRecord]);

    expect(incrementalSnapshot.summary.totalGames).toBe(fullSnapshot.summary.totalGames);
    expect(incrementalSnapshot.summary.wins).toBe(fullSnapshot.summary.wins);
    expect(incrementalSnapshot.summary.losses).toBe(fullSnapshot.summary.losses);
    expect(incrementalSnapshot.summary.draws).toBe(fullSnapshot.summary.draws);
    expect(incrementalSnapshot.summary.winRate).toBeCloseTo(fullSnapshot.summary.winRate, 5);
  });

  it('Free Play record leaves snapshot unchanged', () => {
    const baseRecords = [
      makeGameRecord({ result: 'WHITE_WIN', completedAt: 1 }),
    ];
    const baseSnapshot = computeCareerSnapshot(baseRecords);
    const freePlayRecord = makeGameRecord({ mode: 'free-play', completedAt: 2 });
    const updated = updateCareerSnapshot(baseSnapshot, freePlayRecord);
    expect(updated.summary.totalGames).toBe(1);
  });

  it('extends current streak on win', () => {
    const records = [
      makeGameRecord({ result: 'WHITE_WIN', completedAt: 1 }),
      makeGameRecord({ result: 'WHITE_WIN', completedAt: 2 }),
      makeGameRecord({ result: 'WHITE_WIN', completedAt: 3 }),
    ];
    const baseSnapshot = computeCareerSnapshot(records);
    expect(baseSnapshot.summary.currentWinStreak).toBe(3);

    const newWin = makeGameRecord({ result: 'WHITE_WIN', completedAt: 4 });
    const updated = updateCareerSnapshot(baseSnapshot, newWin);
    expect(updated.summary.currentWinStreak).toBe(4);
    expect(updated.summary.longestWinStreak).toBe(4);
  });

  it('resets current streak on loss', () => {
    const records = [
      makeGameRecord({ result: 'WHITE_WIN', completedAt: 1 }),
      makeGameRecord({ result: 'WHITE_WIN', completedAt: 2 }),
      makeGameRecord({ result: 'WHITE_WIN', completedAt: 3 }),
    ];
    const baseSnapshot = computeCareerSnapshot(records);
    expect(baseSnapshot.summary.currentWinStreak).toBe(3);

    const newLoss = makeGameRecord({ result: 'BLACK_WIN', completedAt: 4 });
    const updated = updateCareerSnapshot(baseSnapshot, newLoss);
    expect(updated.summary.currentWinStreak).toBe(0);
    expect(updated.summary.longestWinStreak).toBe(3);
  });

  it('updates per-mode stats', () => {
    const records = [
      makeGameRecord({ mode: 'CRAZY', result: 'WHITE_WIN', completedAt: 1 }),
    ];
    const baseSnapshot = computeCareerSnapshot(records);
    expect(baseSnapshot.perMode.get('crazy')?.wins).toBe(1);

    const newCrazyWin = makeGameRecord({
      mode: 'CRAZY',
      result: 'WHITE_WIN',
      completedAt: 2,
    });
    const updated = updateCareerSnapshot(baseSnapshot, newCrazyWin);
    expect(updated.perMode.get('crazy')?.wins).toBe(2);
    expect(updated.perMode.get('crazy')?.gamesPlayed).toBe(2);
  });

  it('updates Track 4 milestone when threshold crossed', () => {
    const records = Array.from({ length: 49 }, (_, i) =>
      makeGameRecord({ completedAt: i + 1 }),
    );
    const baseSnapshot = computeCareerSnapshot(records);
    expect(baseSnapshot.track4Milestones[0]?.met).toBe(false);
    expect(baseSnapshot.track4Milestones[0]?.currentValue).toBe(49);

    const record50 = makeGameRecord({ completedAt: 50 });
    const updated = updateCareerSnapshot(baseSnapshot, record50);
    expect(updated.track4Milestones[0]?.met).toBe(true);
    expect(updated.track4Milestones[0]?.currentValue).toBe(50);
  });

  it('Pass Around game in incremental does not affect W/L/D', () => {
    const records = [
      makeGameRecord({ result: 'WHITE_WIN', completedAt: 1 }),
    ];
    const baseSnapshot = computeCareerSnapshot(records);
    const paRecord = makeGameRecord({
      playerWhite: 'HUMAN',
      playerBlack: 'HUMAN',
      result: 'WHITE_WIN',
      completedAt: 2,
    });
    const updated = updateCareerSnapshot(baseSnapshot, paRecord);
    expect(updated.summary.totalGames).toBe(2);
    expect(updated.summary.wins).toBe(1); // unchanged
    expect(updated.perOpponent.passAround.gamesPlayed).toBe(1);
    // Streak should not be affected by PA
    expect(updated.summary.currentWinStreak).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 9. formatPlayTime tests
// ---------------------------------------------------------------------------

describe('formatPlayTime', () => {
  it('formats 0ms as 0m', () => {
    expect(formatPlayTime(0)).toBe('0m');
  });

  it('formats negative as 0m', () => {
    expect(formatPlayTime(-1000)).toBe('0m');
  });

  it('formats 60000ms as 1m', () => {
    expect(formatPlayTime(60000)).toBe('1m');
  });

  it('formats 3600000ms (1 hour) as 1h 0m', () => {
    expect(formatPlayTime(3600000)).toBe('1h 0m');
  });

  it('formats 5400000ms (1.5 hours) as 1h 30m', () => {
    expect(formatPlayTime(5400000)).toBe('1h 30m');
  });

  it('formats 90000000ms (25 hours) as 1d 1h', () => {
    expect(formatPlayTime(90000000)).toBe('1d 1h');
  });

  it('formats 172800000ms (48 hours) as 2d 0h', () => {
    expect(formatPlayTime(172800000)).toBe('2d 0h');
  });

  it('formats 59 minutes as 59m', () => {
    expect(formatPlayTime(59 * 60000)).toBe('59m');
  });
});

// ---------------------------------------------------------------------------
// 10. Event Statistics tests
// ---------------------------------------------------------------------------

describe('computeCareerSnapshot — Event Stats', () => {
  it('returns empty map for games without event logs', () => {
    const records = [
      makeGameRecord({ mode: 'CLASSIC', completedAt: 1 }),
    ];
    const snapshot = computeCareerSnapshot(records);
    expect(snapshot.eventStats.size).toBe(0);
  });

  it('tracks single event with multiple triggers', () => {
    const records = [
      makeGameRecord({
        mode: 'CRAZY',
        result: 'WHITE_WIN',
        completedAt: 1,
        eventTriggerLog: [
          { ply: 5, event: CrazyEvent.KingForADay, triggeredBy: 'WHITE' },
          { ply: 10, event: CrazyEvent.KingForADay, triggeredBy: 'BLACK' },
        ],
      }),
    ];
    const snapshot = computeCareerSnapshot(records);
    const stat = snapshot.eventStats.get(CrazyEvent.KingForADay);
    expect(stat).toBeDefined();
    expect(stat?.triggerCount).toBe(2);
    expect(stat?.gamesWithEvent).toBe(1);
    expect(stat?.winsWithEvent).toBe(1);
  });

  it('tracks same event across multiple games', () => {
    const records = [
      makeGameRecord({
        mode: 'CRAZY', result: 'WHITE_WIN', completedAt: 1,
        eventTriggerLog: [{ ply: 5, event: CrazyEvent.StepBack, triggeredBy: 'WHITE' }],
      }),
      makeGameRecord({
        mode: 'CRAZY', result: 'BLACK_WIN', completedAt: 2,
        eventTriggerLog: [{ ply: 3, event: CrazyEvent.StepBack, triggeredBy: 'BLACK' }],
      }),
      makeGameRecord({
        mode: 'CRAZY', result: 'WHITE_WIN', completedAt: 3,
        eventTriggerLog: [{ ply: 7, event: CrazyEvent.StepBack, triggeredBy: 'WHITE' }],
      }),
    ];
    const snapshot = computeCareerSnapshot(records);
    const stat = snapshot.eventStats.get(CrazyEvent.StepBack);
    expect(stat?.triggerCount).toBe(3);
    expect(stat?.gamesWithEvent).toBe(3);
    expect(stat?.winsWithEvent).toBe(2);
    expect(stat?.lossesWithEvent).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 11. Challenge Stats tests
// ---------------------------------------------------------------------------

describe('computeCareerSnapshot — Challenge Stats', () => {
  it('returns zeros for no challenge records', () => {
    const snapshot = computeCareerSnapshot([]);
    expect(snapshot.challengeStats.puzzlesCompleted).toBe(0);
    expect(snapshot.challengeStats.averageRating).toBe(0);
    expect(snapshot.challengeStats.bestTimeMs).toBeNull();
    expect(snapshot.challengeStats.currentStreak).toBe(0);
    expect(snapshot.challengeStats.totalAttempts).toBe(0);
  });

  it('computes one solved puzzle', () => {
    const challengeRecords = [
      makeChallengeRecord({ puzzleId: 1, solved: true, solveTimeMs: 5000, rating: 3 }),
    ];
    const snapshot = computeCareerSnapshot([], challengeRecords);
    expect(snapshot.challengeStats.puzzlesCompleted).toBe(1);
    expect(snapshot.challengeStats.averageRating).toBe(3);
    expect(snapshot.challengeStats.bestTimeMs).toBe(5000);
    expect(snapshot.challengeStats.totalAttempts).toBe(1);
  });

  it('tracks best time across multiple attempts', () => {
    const challengeRecords = [
      makeChallengeRecord({ puzzleId: 1, solved: false, solveTimeMs: 0, rating: 0, attemptNumber: 1 }),
      makeChallengeRecord({ puzzleId: 1, solved: true, solveTimeMs: 3000, rating: 2, attemptNumber: 2 }),
      makeChallengeRecord({ puzzleId: 1, solved: true, solveTimeMs: 2000, rating: 3, attemptNumber: 3 }),
    ];
    const snapshot = computeCareerSnapshot([], challengeRecords);
    expect(snapshot.challengeStats.puzzlesCompleted).toBe(1);
    expect(snapshot.challengeStats.bestTimeMs).toBe(2000);
    expect(snapshot.challengeStats.totalAttempts).toBe(3);
  });

  it('computes current streak correctly', () => {
    const challengeRecords = [
      makeChallengeRecord({ puzzleId: 1, solved: true, solveTimeMs: 5000, rating: 3, attemptNumber: 1 }),
      makeChallengeRecord({ puzzleId: 2, solved: true, solveTimeMs: 6000, rating: 2, attemptNumber: 1 }),
      makeChallengeRecord({ puzzleId: 3, solved: true, solveTimeMs: 7000, rating: 1, attemptNumber: 1 }),
      makeChallengeRecord({ puzzleId: 4, solved: true, solveTimeMs: 8000, rating: 2, attemptNumber: 1 }),
      makeChallengeRecord({ puzzleId: 5, solved: true, solveTimeMs: 9000, rating: 3, attemptNumber: 1 }),
    ];
    const snapshot = computeCareerSnapshot([], challengeRecords);
    expect(snapshot.challengeStats.currentStreak).toBe(5);
  });

  it('breaks streak at puzzle not solved on first attempt', () => {
    const challengeRecords = [
      makeChallengeRecord({ puzzleId: 1, solved: true, solveTimeMs: 5000, rating: 3, attemptNumber: 1 }),
      makeChallengeRecord({ puzzleId: 2, solved: true, solveTimeMs: 6000, rating: 2, attemptNumber: 1 }),
      makeChallengeRecord({ puzzleId: 3, solved: true, solveTimeMs: 7000, rating: 1, attemptNumber: 1 }),
      makeChallengeRecord({ puzzleId: 4, solved: false, solveTimeMs: 0, rating: 0, attemptNumber: 1 }),
      makeChallengeRecord({ puzzleId: 4, solved: true, solveTimeMs: 8000, rating: 2, attemptNumber: 2 }),
    ];
    const snapshot = computeCareerSnapshot([], challengeRecords);
    expect(snapshot.challengeStats.currentStreak).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 12. Classified Wave Stats tests
// ---------------------------------------------------------------------------

describe('computeCareerSnapshot — Classified Waves', () => {
  it('returns 8 wave entries with correct totalGamesInWave', () => {
    const snapshot = computeCareerSnapshot([]);
    expect(snapshot.classifiedWaves).toHaveLength(8);
    expect(snapshot.classifiedWaves[0]?.totalGamesInWave).toBe(14); // Wave 1
    expect(snapshot.classifiedWaves[1]?.totalGamesInWave).toBe(13); // Wave 2
    expect(snapshot.classifiedWaves[2]?.totalGamesInWave).toBe(10); // Wave 3
    expect(snapshot.classifiedWaves[3]?.totalGamesInWave).toBe(5);  // Wave 4
    expect(snapshot.classifiedWaves[4]?.totalGamesInWave).toBe(6);  // Wave 5
    expect(snapshot.classifiedWaves[5]?.totalGamesInWave).toBe(9);  // Wave 6
    expect(snapshot.classifiedWaves[6]?.totalGamesInWave).toBe(5);  // Wave 7
    expect(snapshot.classifiedWaves[7]?.totalGamesInWave).toBe(2);  // Wave 8
  });

  it('tracks classified game stats per wave', () => {
    const records = [
      makeGameRecord({
        mode: 'classified-1', // Wave 1
        playerBlack: 'CPU_HARD',
        result: 'WHITE_WIN',
        completedAt: 1,
      }),
      makeGameRecord({
        mode: 'classified-2', // Wave 1
        playerBlack: 'CPU_HARD',
        result: 'BLACK_WIN',
        completedAt: 2,
      }),
    ];
    const snapshot = computeCareerSnapshot(records);
    const wave1 = snapshot.classifiedWaves[0];
    expect(wave1?.gamesPlayed).toBe(2);
    expect(wave1?.wins).toBe(1);
    expect(wave1?.losses).toBe(1);
    expect(wave1?.hardWins).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 13. Chaos Gate tests
// ---------------------------------------------------------------------------

describe('computeCareerSnapshot — Chaos Gate', () => {
  it('returns zero progress with no data', () => {
    const snapshot = computeCareerSnapshot([]);
    expect(snapshot.chaosGate.challengesCompleted).toBe(0);
    expect(snapshot.chaosGate.choiceModesUnlocked).toBe(0);
    expect(snapshot.chaosGate.classifiedUnlocked).toBe(false);
    expect(snapshot.chaosGate.classifiedHardWins).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 14. Edge Cases
// ---------------------------------------------------------------------------

describe('Edge Cases', () => {
  it('all games are Pass Around — W/L/D all zero, streaks zero', () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      makeGameRecord({
        playerWhite: 'HUMAN',
        playerBlack: 'HUMAN',
        result: 'WHITE_WIN',
        completedAt: i + 1,
      }),
    );
    const snapshot = computeCareerSnapshot(records);
    expect(snapshot.summary.totalGames).toBe(5);
    expect(snapshot.summary.wins).toBe(0);
    expect(snapshot.summary.losses).toBe(0);
    expect(snapshot.summary.draws).toBe(0);
    expect(snapshot.summary.currentWinStreak).toBe(0);
    expect(snapshot.summary.longestWinStreak).toBe(0);
  });

  it('all games are Free Play — snapshot is empty', () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      makeGameRecord({ mode: 'free-play', completedAt: i + 1 }),
    );
    const snapshot = computeCareerSnapshot(records);
    expect(snapshot.summary.totalGames).toBe(0);
  });

  it('record with empty moves array', () => {
    const records = [
      makeGameRecord({ moves: [], completedAt: 1 }),
    ];
    const snapshot = computeCareerSnapshot(records);
    expect(snapshot.summary.totalGames).toBe(1);
    expect(snapshot.summary.averageGameLengthPlies).toBe(0);
  });

  it('win rate is 0 when no decisive games', () => {
    const records = [
      makeGameRecord({ result: 'DRAW', completedAt: 1 }),
      makeGameRecord({ result: 'DRAW', completedAt: 2 }),
    ];
    const snapshot = computeCareerSnapshot(records);
    expect(snapshot.summary.winRate).toBe(0);
    expect(Number.isNaN(snapshot.summary.winRate)).toBe(false);
  });

  it('Choice game missing activeEventsPerPly falls back to Classic and is counted', () => {
    const records = [
      makeGameRecord({ mode: 'CHOICE', completedAt: 1 }),
    ];
    const snapshot = computeCareerSnapshot(records);
    // Falls back to 'classic' so Cogitate adapter resolution still works;
    // the game is counted under Classic rather than silently excluded.
    expect(snapshot.summary.totalGames).toBe(1);
  });

  it('exactly at track threshold counts as met', () => {
    const challengeRecords = [
      makeChallengeRecord({ puzzleId: 1, solved: true, solveTimeMs: 5000, rating: 3 }),
    ];
    const snapshot = computeCareerSnapshot([], challengeRecords);
    // Track 1 threshold[0] = 1 — exactly met
    const track1 = snapshot.tracks[0];
    expect(track1?.completedMilestones).toBe(1);
  });

  it('negative play time is clamped in computation', () => {
    const records = [
      makeGameRecord({
        startedAt: 2000,
        completedAt: 1000,
      }),
    ];
    const snapshot = computeCareerSnapshot(records);
    expect(snapshot.summary.totalPlayTimeMs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 15. Performance test
// ---------------------------------------------------------------------------

describe('Performance', () => {
  it('computes 1000 records in under 100ms', () => {
    const records = Array.from({ length: 1000 }, (_, i) =>
      makeGameRecord({
        completedAt: i + 1,
        result: i % 3 === 0 ? 'WHITE_WIN' : i % 3 === 1 ? 'BLACK_WIN' : 'DRAW',
        playerBlack: i % 2 === 0 ? 'CPU_EASY' : 'CPU_HARD',
      }),
    );

    const start = performance.now();
    const snapshot = computeCareerSnapshot(records);
    const elapsed = performance.now() - start;

    expect(snapshot.summary.totalGames).toBe(1000);
    expect(elapsed).toBeLessThan(100);
  });

  it('incremental update is fast (under 5ms)', () => {
    const records = Array.from({ length: 100 }, (_, i) =>
      makeGameRecord({ completedAt: i + 1 }),
    );
    const baseSnapshot = computeCareerSnapshot(records);
    const newRecord = makeGameRecord({ completedAt: 101 });

    const start = performance.now();
    const updated = updateCareerSnapshot(baseSnapshot, newRecord);
    const elapsed = performance.now() - start;

    expect(updated.summary.totalGames).toBe(101);
    expect(elapsed).toBeLessThan(5);
  });
});
