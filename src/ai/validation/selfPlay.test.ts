import { describe, it, expect } from 'vitest';
import {
  createSeededRandom,
  playSingleGame,
  runMatch,
  VALID_REASONS,
  type MatchConfig,
} from './selfPlay';

// ---------------------------------------------------------------------------
// createSeededRandom
// ---------------------------------------------------------------------------

describe('createSeededRandom', () => {
  it('produces deterministic output from the same seed', () => {
    const rng1 = createSeededRandom(12345);
    const rng2 = createSeededRandom(12345);
    const seq1 = Array.from({ length: 100 }, () => rng1());
    const seq2 = Array.from({ length: 100 }, () => rng2());
    expect(seq1).toEqual(seq2);
  });

  it('produces different sequences for different seeds', () => {
    const rng1 = createSeededRandom(12345);
    const rng2 = createSeededRandom(54321);
    const seq1 = Array.from({ length: 100 }, () => rng1());
    const seq2 = Array.from({ length: 100 }, () => rng2());
    expect(seq1).not.toEqual(seq2);
  });

  it('all values are in [0, 1)', () => {
    const rng = createSeededRandom(42);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

// ---------------------------------------------------------------------------
// playSingleGame
// ---------------------------------------------------------------------------

describe('playSingleGame', () => {
  it('completes a game between two Easy AIs', () => {
    const rng = createSeededRandom(42);
    const record = playSingleGame('easy', 'easy', 300, rng);

    expect(['white', 'black', 'draw']).toContain(record.result);
    expect(record.reason).toBeTruthy();
    expect(record.moveCount).toBeGreaterThan(0);
    expect(record.cappedByMoveLimit).toBe(false);
  }, 60_000);

  it('completes a game between two Hard AIs', () => {
    const rng = createSeededRandom(99);
    const record = playSingleGame('hard', 'hard', 300, rng);

    expect(['white', 'black', 'draw']).toContain(record.result);
    expect(record.reason).toBeTruthy();
  }, 120_000);

  it('is deterministic for the same seed', () => {
    const rng1 = createSeededRandom(100);
    const rng2 = createSeededRandom(100);
    const r1 = playSingleGame('easy', 'easy', 300, rng1);
    const r2 = playSingleGame('easy', 'easy', 300, rng2);

    expect(r1.result).toBe(r2.result);
    expect(r1.reason).toBe(r2.reason);
    expect(r1.moveCount).toBe(r2.moveCount);
  }, 60_000);

  it('produces different games for different seeds', () => {
    const r1 = playSingleGame('easy', 'easy', 300, createSeededRandom(100));
    const r2 = playSingleGame('easy', 'easy', 300, createSeededRandom(200));

    // With high probability at least one field differs
    const identical =
      r1.result === r2.result && r1.reason === r2.reason && r1.moveCount === r2.moveCount;
    expect(identical).toBe(false);
  }, 60_000);

  it('respects the maxMoves cap', () => {
    const rng = createSeededRandom(42);
    const record = playSingleGame('easy', 'easy', 5, rng);

    expect(record.moveCount).toBeLessThanOrEqual(5);
    expect(record.cappedByMoveLimit).toBe(true);
  }, 30_000);
});

// ---------------------------------------------------------------------------
// runMatch
// ---------------------------------------------------------------------------

describe('runMatch', () => {
  const baseConfig: MatchConfig = {
    gameCount: 3,
    whiteDifficulty: 'easy',
    blackDifficulty: 'easy',
    alternateColors: false,
    maxMovesPerGame: 300,
    seed: 42,
  };

  it('runs the correct number of games', () => {
    const config: MatchConfig = { ...baseConfig, gameCount: 3 };
    const result = runMatch(config);

    expect(result.totalGames).toBe(3);
    expect(result.games).toHaveLength(3);
  }, 120_000);

  it('alternates colors when configured', () => {
    const config: MatchConfig = {
      ...baseConfig,
      gameCount: 4,
      whiteDifficulty: 'hard',
      blackDifficulty: 'easy',
      alternateColors: true,
    };
    const result = runMatch(config);

    const [g0, g1, g2, g3] = result.games;
    expect(g0?.whiteDifficulty).toBe('hard');
    expect(g1?.whiteDifficulty).toBe('easy');
    expect(g2?.whiteDifficulty).toBe('hard');
    expect(g3?.whiteDifficulty).toBe('easy');
  }, 300_000);

  it('does not alternate colors when disabled', () => {
    const config: MatchConfig = {
      ...baseConfig,
      gameCount: 4,
      whiteDifficulty: 'easy',
      blackDifficulty: 'easy',
      alternateColors: false,
    };
    const result = runMatch(config);

    for (const game of result.games) {
      expect(game.whiteDifficulty).toBe('easy');
      expect(game.blackDifficulty).toBe('easy');
    }
  }, 60_000);

  it('computes correct aggregate statistics', () => {
    const result = runMatch(baseConfig);

    expect(result.wins.white + result.wins.black + result.wins.draw).toBe(result.totalGames);

    const totalMoves = result.games.reduce((s, g) => s + g.moveCount, 0);
    expect(result.avgMoveCount).toBeCloseTo(totalMoves / result.totalGames);

    const maxMC = Math.max(...result.games.map((g) => g.moveCount));
    const minMC = Math.min(...result.games.map((g) => g.moveCount));
    expect(result.maxMoveCount).toBe(maxMC);
    expect(result.minMoveCount).toBe(minMC);
  }, 120_000);

  it('correctly computes primaryWinRate for Hard vs. Easy with alternation', () => {
    const config: MatchConfig = {
      ...baseConfig,
      gameCount: 4,
      whiteDifficulty: 'hard',
      blackDifficulty: 'easy',
      alternateColors: true,
    };
    const result = runMatch(config);

    // Manually count Hard's wins
    let hardWins = 0;
    for (const game of result.games) {
      const hardIsWhite = game.whiteDifficulty === 'hard';
      if (hardIsWhite && game.result === 'white') hardWins++;
      if (!hardIsWhite && game.result === 'black') hardWins++;
    }
    expect(result.primaryWinRate).toBeCloseTo(hardWins / result.totalGames);
  }, 300_000);

  it('calls onGameComplete after each game', () => {
    const records: number[] = [];
    const config: MatchConfig = {
      ...baseConfig,
      gameCount: 3,
      onGameComplete: (record) => records.push(record.gameNumber),
    };
    runMatch(config);

    expect(records).toEqual([1, 2, 3]);
  }, 120_000);

  it('flags anomalous games (move-limit cap)', () => {
    const config: MatchConfig = {
      ...baseConfig,
      gameCount: 2,
      maxMovesPerGame: 5,
    };
    const result = runMatch(config);

    // All games should be capped (no checkers game ends in 5 moves)
    expect(result.cappedGames).toBe(2);
    for (const game of result.games) {
      expect(result.anomalousGames).toContain(game.gameNumber);
    }
  }, 30_000);
});

// ---------------------------------------------------------------------------
// AI Validation — Reduced Suite (regression catch)
// ---------------------------------------------------------------------------

describe('AI Validation — Reduced Suite', () => {
  it('Hard vs. Easy: 10 games complete without errors', () => {
    const result = runMatch({
      gameCount: 10,
      whiteDifficulty: 'hard',
      blackDifficulty: 'easy',
      alternateColors: true,
      maxMovesPerGame: 300,
      seed: 42,
    });

    expect(result.totalGames).toBe(10);
    expect(result.cappedGames).toBe(0);
    for (const game of result.games) {
      expect(['white', 'black', 'draw']).toContain(game.result);
    }
  }, 300_000);

  it('Hard vs. Hard: 5 games complete without errors', () => {
    const result = runMatch({
      gameCount: 5,
      whiteDifficulty: 'hard',
      blackDifficulty: 'hard',
      alternateColors: false,
      maxMovesPerGame: 300,
      seed: 100_042,
    });

    expect(result.totalGames).toBe(5);
    expect(result.cappedGames).toBe(0);
    for (const game of result.games) {
      expect(['white', 'black', 'draw']).toContain(game.result);
    }
  }, 600_000);

  it('all game reasons are valid engine reasons', () => {
    const result = runMatch({
      gameCount: 5,
      whiteDifficulty: 'easy',
      blackDifficulty: 'easy',
      alternateColors: false,
      maxMovesPerGame: 300,
      seed: 77,
    });

    for (const game of result.games) {
      expect(VALID_REASONS).toContain(game.reason);
    }
  }, 120_000);

  it('no game produces a suspiciously short result', () => {
    const easyResult = runMatch({
      gameCount: 5,
      whiteDifficulty: 'easy',
      blackDifficulty: 'easy',
      alternateColors: false,
      maxMovesPerGame: 300,
      seed: 42,
    });

    for (const game of easyResult.games) {
      expect(game.moveCount).toBeGreaterThanOrEqual(10);
    }
  }, 120_000);
});
