import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNewGame, makeMove, resign } from '../engine/game';
import { createAmericanRules } from '../engine/rules';
import { PlayerType, GameStatus } from '../engine/types';
import type { GameState } from '../engine/types';
import {
  recordGame,
  getAllGameRecords,
  getGameRecord,
  getGameRecordCount,
  clearGameHistory,
} from './gameHistory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let uuidCounter = 0;
beforeEach(() => {
  uuidCounter = 0;
  vi.stubGlobal('crypto', {
    getRandomValues: crypto.getRandomValues.bind(crypto),
    randomUUID: () => {
      uuidCounter++;
      return `test-uuid-${String(uuidCounter)}`;
    },
  });
});

function createTestGame(): GameState {
  const ruleSet = createAmericanRules();
  const players = { white: PlayerType.Human, black: PlayerType.CpuEasy };
  return createNewGame(ruleSet, players);
}

function playMoves(state: GameState, count: number): GameState {
  let current = state;
  for (let i = 0; i < count; i++) {
    const moves = current.ruleSet.getLegalMoves(current.board, current.activeColor);
    if (moves.length === 0 || current.status !== GameStatus.InProgress) break;
    const move = moves[0];
    if (move === undefined) break;
    current = makeMove(current, move);
  }
  return current;
}

function createFinishedGame(moveCount: number): GameState {
  const game = playMoves(createTestGame(), moveCount);
  if (game.status === GameStatus.InProgress) {
    return resign(game, game.activeColor);
  }
  return game;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('recordGame', () => {
  beforeEach(async () => {
    await clearGameHistory();
  });

  it('creates a record', async () => {
    const game = createFinishedGame(4);
    await recordGame(game, 'classic', Date.now() - 60000);
    expect(await getGameRecordCount()).toBe(1);
  });

  it('stores correct fields', async () => {
    const startedAt = Date.now() - 120000;
    const game = createFinishedGame(6);
    const id = await recordGame(game, 'classic', startedAt);

    const record = await getGameRecord(id);
    expect(record).toBeDefined();
    if (record === undefined) throw new Error('Record should exist');
    expect(record.mode).toBe('classic');
    expect(record.playerWhite).toBe(PlayerType.Human);
    expect(record.playerBlack).toBe(PlayerType.CpuEasy);
    expect(record.result).toBeTruthy();
    expect(record.reason).toBeTruthy();
    expect(record.moves.length).toBeGreaterThan(0);
    expect(record.boardStates.length).toBe(record.moves.length + 1);
    expect(record.startedAt).toBe(startedAt);
    expect(record.completedAt).toBeGreaterThan(0);
  });

  it('generates unique IDs', async () => {
    const game1 = createFinishedGame(4);
    const game2 = createFinishedGame(6);
    const id1 = await recordGame(game1, 'classic', Date.now());
    const id2 = await recordGame(game2, 'classic', Date.now());
    expect(id1).not.toBe(id2);
  });

  it('rejects non-game-over state', async () => {
    const game = createTestGame();
    await expect(recordGame(game, 'classic', Date.now())).rejects.toThrow(
      'Cannot record a game that has no result.',
    );
  });
});

describe('getAllGameRecords', () => {
  beforeEach(async () => {
    await clearGameHistory();
  });

  it('returns newest first', async () => {
    const game1 = createFinishedGame(4);
    const game2 = createFinishedGame(6);
    const game3 = createFinishedGame(8);

    await recordGame(game1, 'classic', Date.now() - 30000);
    await recordGame(game2, 'classic', Date.now() - 20000);
    await recordGame(game3, 'classic', Date.now() - 10000);

    const records = await getAllGameRecords();
    expect(records.length).toBe(3);
    const r0 = records[0];
    const r1 = records[1];
    const r2 = records[2];
    if (r0 === undefined || r1 === undefined || r2 === undefined) {
      throw new Error('Expected 3 records');
    }
    expect(r0.completedAt).toBeGreaterThanOrEqual(r1.completedAt);
    expect(r1.completedAt).toBeGreaterThanOrEqual(r2.completedAt);
  });
});

describe('getGameRecord', () => {
  beforeEach(async () => {
    await clearGameHistory();
  });

  it('returns undefined for missing ID', async () => {
    const record = await getGameRecord('nonexistent-id');
    expect(record).toBeUndefined();
  });
});

describe('clearGameHistory', () => {
  it('removes all records', async () => {
    const game = createFinishedGame(4);
    await recordGame(game, 'classic', Date.now());
    await recordGame(game, 'classic', Date.now());
    await clearGameHistory();
    expect(await getGameRecordCount()).toBe(0);
  });
});

describe('boardStates', () => {
  beforeEach(async () => {
    await clearGameHistory();
  });

  it('has correct length (initial + one per move)', async () => {
    const game = createFinishedGame(10);
    const moveCount = game.moveHistory.length;
    const id = await recordGame(game, 'classic', Date.now());

    const record = await getGameRecord(id);
    if (record === undefined) throw new Error('Record should exist');
    expect(record.boardStates.length).toBe(moveCount + 1);
  });

  it('each board state is a 32-character string', async () => {
    const game = createFinishedGame(6);
    const id = await recordGame(game, 'classic', Date.now());

    const record = await getGameRecord(id);
    if (record === undefined) throw new Error('Record should exist');
    for (const state of record.boardStates) {
      expect(state).toHaveLength(32);
    }
  });
});

describe('moves notation', () => {
  beforeEach(async () => {
    await clearGameHistory();
  });

  it('moves match expected notation format', async () => {
    const game = createFinishedGame(6);
    const id = await recordGame(game, 'classic', Date.now());

    const record = await getGameRecord(id);
    if (record === undefined) throw new Error('Record should exist');
    for (const move of record.moves) {
      expect(move).toMatch(/^\d+[-x]\d+(x\d+)*$/);
    }
  });
});
