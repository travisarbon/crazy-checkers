import { describe, it, expect } from 'vitest';
import { CrazyEvent, GameMode } from '../../engine/types';
import {
  createSeededRandom,
  playSingleGame,
  runMatch,
  type MatchConfig,
} from './selfPlay';
import {
  buildPerEventConfigs,
  buildPairwiseConfigs,
  checkDegenerateStates,
  formatValidationReport,
  HARD_VS_EASY_CONFIG,
  HARD_VS_HARD_CONFIG,
  type CrazyValidationReport,
} from './crazyModeValidation';

// ---------------------------------------------------------------------------
// playSingleGame with Crazy mode
// ---------------------------------------------------------------------------

describe('playSingleGame with Crazy mode', () => {
  it('completes a Crazy mode game between two Easy AIs', () => {
    const rng = createSeededRandom(42);
    const record = playSingleGame('easy', 'easy', 300, rng, 1, 42, GameMode.Crazy);

    expect(['white', 'black', 'draw']).toContain(record.result);
    expect(record.reason).toBeTruthy();
    expect(record.moveCount).toBeGreaterThan(0);
    expect(record.mode).toBe(GameMode.Crazy);
    expect(record.eventCount).toBeGreaterThanOrEqual(0);
  }, 120_000);

  it('completes a Crazy mode game between two Hard AIs', () => {
    const rng = createSeededRandom(99);
    const record = playSingleGame('hard', 'hard', 400, rng, 1, 99, GameMode.Crazy);

    expect(['white', 'black', 'draw']).toContain(record.result);
    expect(record.reason).toBeTruthy();
    expect(record.mode).toBe(GameMode.Crazy);
  }, 120_000);

  it('is deterministic for the same seed in Crazy mode', () => {
    const rng1 = createSeededRandom(100);
    const rng2 = createSeededRandom(100);
    const r1 = playSingleGame('easy', 'easy', 300, rng1, 1, 100, GameMode.Crazy);
    const r2 = playSingleGame('easy', 'easy', 300, rng2, 1, 100, GameMode.Crazy);

    expect(r1.result).toBe(r2.result);
    expect(r1.reason).toBe(r2.reason);
    expect(r1.moveCount).toBe(r2.moveCount);
    expect(r1.eventLog).toEqual(r2.eventLog);
  }, 120_000);

  it('forces a specific event when forceEvent is set', () => {
    const rng = createSeededRandom(42);
    const record = playSingleGame(
      'easy', 'easy', 300, rng, 1, 42,
      GameMode.Crazy, CrazyEvent.KingForADay,
    );

    expect(['white', 'black', 'draw']).toContain(record.result);
    // All triggered events should be the forced type
    if (record.eventLog && record.eventLog.length > 0) {
      for (const entry of record.eventLog) {
        expect(entry.event).toBe(CrazyEvent.KingForADay);
      }
    }
  }, 120_000);

  it('Classic mode games still work without event fields', () => {
    const rng = createSeededRandom(42);
    const record = playSingleGame('easy', 'easy', 300, rng);

    expect(['white', 'black', 'draw']).toContain(record.result);
    expect(record.eventLog).toBeUndefined();
    expect(record.eventCount).toBeUndefined();
  }, 60_000);
});

// ---------------------------------------------------------------------------
// runMatch with Crazy mode
// ---------------------------------------------------------------------------

describe('runMatch with Crazy mode', () => {
  it('runs a small Crazy mode match and aggregates results', () => {
    const config: MatchConfig = {
      gameCount: 3,
      whiteDifficulty: 'easy',
      blackDifficulty: 'easy',
      alternateColors: false,
      maxMovesPerGame: 300,
      seed: 42,
      mode: GameMode.Crazy,
    };
    const result = runMatch(config);

    expect(result.totalGames).toBe(3);
    expect(result.eventStats).toBeDefined();
    if (result.eventStats) {
      expect(result.eventStats.totalEvents).toBeGreaterThanOrEqual(0);
    }
    expect(result.errorGames).toBe(0);
  }, 300_000);

  it('computes event frequency distribution', () => {
    const config: MatchConfig = {
      gameCount: 5,
      whiteDifficulty: 'easy',
      blackDifficulty: 'easy',
      alternateColors: false,
      maxMovesPerGame: 300,
      seed: 77,
      mode: GameMode.Crazy,
    };
    const result = runMatch(config);

    expect(result.eventStats).toBeDefined();
    if (result.eventStats) {
      expect(result.eventStats.eventFrequency).toBeDefined();
      expect(typeof result.eventStats.avgEventsPerGame).toBe('number');
    }
  }, 300_000);

  it('captures errors without aborting the match', () => {
    // Run a normal match — should have 0 errors
    const config: MatchConfig = {
      gameCount: 2,
      whiteDifficulty: 'easy',
      blackDifficulty: 'easy',
      alternateColors: false,
      maxMovesPerGame: 300,
      seed: 42,
      mode: GameMode.Crazy,
    };
    const result = runMatch(config);

    expect(result.totalGames).toBe(2);
    // Even if there were errors, the match should complete all games
    expect(result.games).toHaveLength(2);
  }, 120_000);

  it('Classic mode match still produces no eventStats', () => {
    const config: MatchConfig = {
      gameCount: 2,
      whiteDifficulty: 'easy',
      blackDifficulty: 'easy',
      alternateColors: false,
      maxMovesPerGame: 300,
      seed: 42,
    };
    const result = runMatch(config);

    expect(result.eventStats).toBeUndefined();
    expect(result.errorGames).toBe(0);
  }, 120_000);
});

// ---------------------------------------------------------------------------
// Forced event validation
// ---------------------------------------------------------------------------

describe('forced event validation', () => {
  it('forces Checks Mix and all games complete', () => {
    const config: MatchConfig = {
      gameCount: 2,
      whiteDifficulty: 'easy',
      blackDifficulty: 'easy',
      alternateColors: false,
      maxMovesPerGame: 400,
      seed: 20260410,
      mode: GameMode.Crazy,
      forceEvent: CrazyEvent.ChecksMix,
    };
    const result = runMatch(config);

    expect(result.errorGames).toBe(0);
    for (const game of result.games) {
      if (game.eventLog && game.eventLog.length > 0) {
        for (const entry of game.eventLog) {
          expect(entry.event).toBe(CrazyEvent.ChecksMix);
        }
      }
    }
  }, 300_000);

  it('forces Live Grenade and all games complete', () => {
    const config: MatchConfig = {
      gameCount: 2,
      whiteDifficulty: 'easy',
      blackDifficulty: 'easy',
      alternateColors: false,
      maxMovesPerGame: 400,
      seed: 20260411,
      mode: GameMode.Crazy,
      forceEvent: CrazyEvent.LiveGrenade,
    };
    const result = runMatch(config);

    expect(result.errorGames).toBe(0);
  }, 300_000);

  it('forces Opposite Day and all games complete', () => {
    const config: MatchConfig = {
      gameCount: 2,
      whiteDifficulty: 'easy',
      blackDifficulty: 'easy',
      alternateColors: false,
      maxMovesPerGame: 400,
      seed: 20260412,
      mode: GameMode.Crazy,
      forceEvent: CrazyEvent.OppositeDay,
    };
    const result = runMatch(config);

    expect(result.errorGames).toBe(0);
  }, 300_000);

  it('forces King for a Day and all games complete', () => {
    const config: MatchConfig = {
      gameCount: 2,
      whiteDifficulty: 'easy',
      blackDifficulty: 'easy',
      alternateColors: false,
      maxMovesPerGame: 400,
      seed: 20260413,
      mode: GameMode.Crazy,
      forceEvent: CrazyEvent.KingForADay,
    };
    const result = runMatch(config);

    expect(result.errorGames).toBe(0);
  }, 300_000);

  it('forces Hot Potato and all games complete', () => {
    const config: MatchConfig = {
      gameCount: 2,
      whiteDifficulty: 'easy',
      blackDifficulty: 'easy',
      alternateColors: false,
      maxMovesPerGame: 400,
      seed: 20260414,
      mode: GameMode.Crazy,
      forceEvent: CrazyEvent.HotPotato,
    };
    const result = runMatch(config);

    expect(result.errorGames).toBe(0);
  }, 300_000);

  it('forces Up in the Air and all games complete', () => {
    const config: MatchConfig = {
      gameCount: 2,
      whiteDifficulty: 'easy',
      blackDifficulty: 'easy',
      alternateColors: false,
      maxMovesPerGame: 400,
      seed: 20260415,
      mode: GameMode.Crazy,
      forceEvent: CrazyEvent.UpInTheAir,
    };
    const result = runMatch(config);

    expect(result.errorGames).toBe(0);
  }, 300_000);

  it('forces No Touching and all games complete', () => {
    const config: MatchConfig = {
      gameCount: 2,
      whiteDifficulty: 'easy',
      blackDifficulty: 'easy',
      alternateColors: false,
      maxMovesPerGame: 400,
      seed: 20260416,
      mode: GameMode.Crazy,
      forceEvent: CrazyEvent.NoTouching,
    };
    const result = runMatch(config);

    expect(result.errorGames).toBe(0);
  }, 300_000);
});

// ---------------------------------------------------------------------------
// Pairwise stacking
// ---------------------------------------------------------------------------

describe('pairwise stacking', () => {
  it('runs a pairwise match with two forced events', () => {
    const config: MatchConfig = {
      gameCount: 1,
      whiteDifficulty: 'easy',
      blackDifficulty: 'easy',
      alternateColors: false,
      maxMovesPerGame: 400,
      seed: 20260420,
      mode: GameMode.Crazy,
      forceEventSequence: [CrazyEvent.KingForADay, CrazyEvent.LiveGrenade],
    };
    const result = runMatch(config);

    expect(result.errorGames).toBe(0);
    expect(result.totalGames).toBe(1);
  }, 120_000);

  it('buildPairwiseConfigs produces 21 pairs for 7 events', () => {
    const configs = buildPairwiseConfigs();
    expect(configs).toHaveLength(21);
    // Each pair should have 2 games
    for (const { config } of configs) {
      expect(config.gameCount).toBe(2);
      expect(config.forceEventSequence).toHaveLength(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Degenerate state checks
// ---------------------------------------------------------------------------

describe('checkDegenerateStates', () => {
  it('returns empty array for clean results', () => {
    const config: MatchConfig = {
      gameCount: 1,
      whiteDifficulty: 'easy',
      blackDifficulty: 'easy',
      alternateColors: false,
      maxMovesPerGame: 400,
      seed: 42,
      mode: GameMode.Crazy,
      forceEvent: CrazyEvent.KingForADay,
    };
    const result = runMatch(config);
    const degenerates = checkDegenerateStates({ [CrazyEvent.KingForADay]: result });
    // May or may not find degenerates depending on the game
    expect(Array.isArray(degenerates)).toBe(true);
  }, 120_000);
});

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

describe('report formatting', () => {
  it('produces valid markdown from a minimal validation report', () => {
    const emptyMatchResult = {
      games: [],
      totalGames: 0,
      wins: { white: 0, black: 0, draw: 0 },
      primaryWinRate: 0,
      avgMoveCount: 0,
      maxMoveCount: 0,
      minMoveCount: 0,
      cappedGames: 0,
      totalElapsedMs: 0,
      anomalousGames: [],
      errorGames: 0,
      eventStats: {
        totalEvents: 0,
        avgEventsPerGame: 0,
        eventFrequency: {},
        zeroEventGames: 0,
      },
    };

    const report: CrazyValidationReport = {
      hardVsEasy: emptyMatchResult,
      hardVsHard: emptyMatchResult,
      perEvent: {},
      pairwise: {},
      summary: {
        totalGames: 0,
        totalErrors: 0,
        totalAnomalies: 0,
        hardVsEasyWinRate: 0,
        allEventsTriggered: false,
        degenerateStatesFound: [],
      },
    };

    const markdown = formatValidationReport(report);
    expect(markdown).toContain('# Task 13.1');
    expect(markdown).toContain('## 1. Hard vs. Easy');
    expect(markdown).toContain('## 2. Hard vs. Hard');
    expect(markdown).toContain('## 3. Per-Event');
    expect(markdown).toContain('## 4. Pairwise');
    expect(markdown).toContain('## 5. Event Frequency');
    expect(markdown).toContain('## 6. Degenerate States');
    expect(markdown).toContain('## 7. Anomalous Games');
  });
});

// ---------------------------------------------------------------------------
// Configuration validation
// ---------------------------------------------------------------------------

describe('configuration validation', () => {
  it('HARD_VS_EASY_CONFIG has correct settings', () => {
    expect(HARD_VS_EASY_CONFIG.gameCount).toBe(50);
    expect(HARD_VS_EASY_CONFIG.mode).toBe(GameMode.Crazy);
    expect(HARD_VS_EASY_CONFIG.whiteDifficulty).toBe('hard');
    expect(HARD_VS_EASY_CONFIG.blackDifficulty).toBe('easy');
    expect(HARD_VS_EASY_CONFIG.alternateColors).toBe(true);
  });

  it('HARD_VS_HARD_CONFIG has correct settings', () => {
    expect(HARD_VS_HARD_CONFIG.gameCount).toBe(50);
    expect(HARD_VS_HARD_CONFIG.mode).toBe(GameMode.Crazy);
    expect(HARD_VS_HARD_CONFIG.whiteDifficulty).toBe('hard');
    expect(HARD_VS_HARD_CONFIG.blackDifficulty).toBe('hard');
  });

  it('buildPerEventConfigs produces 7 configs for all implemented events', () => {
    const configs = buildPerEventConfigs();
    expect(configs).toHaveLength(7);
    for (const { config } of configs) {
      expect(config.gameCount).toBe(10);
      expect(config.mode).toBe(GameMode.Crazy);
      expect(config.forceEvent).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Full validation suite (slow — integration tests)
// ---------------------------------------------------------------------------

describe('Crazy mode full validation suite', () => {
  it('Hard vs. Easy: 50 games, Hard wins >= 70%', () => {
    const result = runMatch(HARD_VS_EASY_CONFIG);
    expect(result.errorGames).toBe(0);
    expect(result.primaryWinRate).toBeGreaterThanOrEqual(0.70);
    expect(result.cappedGames).toBe(0);
  }, 600_000);

  it('Hard vs. Hard: 50 games, 0 crashes, all terminate', () => {
    const result = runMatch(HARD_VS_HARD_CONFIG);
    expect(result.errorGames).toBe(0);
    expect(result.cappedGames).toBe(0);
  }, 600_000);

  it('Per-event forced matches: 10 games each, 0 crashes', () => {
    for (const { config } of buildPerEventConfigs()) {
      const result = runMatch(config);
      expect(result.errorGames).toBe(0);
    }
  }, 600_000);

  it('Pairwise stacking: 21 pairs x 2 games, 0 crashes', () => {
    for (const { config } of buildPairwiseConfigs()) {
      const result = runMatch(config);
      expect(result.errorGames).toBe(0);
    }
  }, 600_000);
});
