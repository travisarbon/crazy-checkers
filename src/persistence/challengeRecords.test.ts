import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordChallengeAttempt,
  getAllChallengeRecords,
  getRecordsForPuzzle,
  getBestForPuzzle,
  getChallengesCompletedCount,
  getChallengeRecordCount,
  clearChallengeHistory,
  computeChallengeProgress,
  updateProgressWithNewRecord,
  type ChallengeRecord,
} from './challengeRecords';

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

/** Creates a ChallengeRecord object for snapshot computation tests. */
function makeRecord(
  overrides: Partial<ChallengeRecord> & { puzzleId: number },
): ChallengeRecord {
  return {
    id: crypto.randomUUID(),
    solved: false,
    solveTimeMs: 0,
    rating: 0,
    movesPlayed: [],
    attemptNumber: 1,
    completedAt: Date.now(),
    ...overrides,
  };
}

/** Asserts array element exists and returns it. */
function at<T>(arr: T[], index: number): T {
  const value = arr[index];
  if (value === undefined) throw new Error(`Expected element at index ${String(index)}`);
  return value;
}

// ---------------------------------------------------------------------------
// CRUD Unit Tests (9.1)
// ---------------------------------------------------------------------------

describe('recordChallengeAttempt', () => {
  beforeEach(async () => {
    await clearChallengeHistory();
  });

  it('creates a record with correct fields', async () => {
    const id = await recordChallengeAttempt(1, true, 5000, 3, ['9-14', '14-18']);

    const records = await getAllChallengeRecords();
    expect(records).toHaveLength(1);
    const record = at(records, 0);
    expect(record.id).toBe(id);
    expect(record.puzzleId).toBe(1);
    expect(record.solved).toBe(true);
    expect(record.solveTimeMs).toBe(5000);
    expect(record.rating).toBe(3);
    expect(record.movesPlayed).toEqual(['9-14', '14-18']);
    expect(record.attemptNumber).toBe(1);
    expect(record.completedAt).toBeGreaterThan(0);
  });

  it('auto-increments attemptNumber', async () => {
    await recordChallengeAttempt(1, false, 0, 0, []);
    await recordChallengeAttempt(1, false, 0, 0, []);
    await recordChallengeAttempt(1, true, 8000, 2, ['9-14']);

    const records = await getRecordsForPuzzle(1);
    expect(records).toHaveLength(3);
    expect(at(records, 0).attemptNumber).toBe(1);
    expect(at(records, 1).attemptNumber).toBe(2);
    expect(at(records, 2).attemptNumber).toBe(3);
  });

  it('handles concurrent puzzles with independent attempt numbers', async () => {
    await recordChallengeAttempt(1, true, 5000, 3, []);
    await recordChallengeAttempt(2, true, 6000, 2, []);
    await recordChallengeAttempt(3, true, 7000, 1, []);
    await recordChallengeAttempt(1, true, 4000, 3, []);

    const p1 = await getRecordsForPuzzle(1);
    const p2 = await getRecordsForPuzzle(2);
    const p3 = await getRecordsForPuzzle(3);

    expect(p1).toHaveLength(2);
    expect(at(p1, 0).attemptNumber).toBe(1);
    expect(at(p1, 1).attemptNumber).toBe(2);
    expect(p2).toHaveLength(1);
    expect(at(p2, 0).attemptNumber).toBe(1);
    expect(p3).toHaveLength(1);
    expect(at(p3, 0).attemptNumber).toBe(1);
  });

  it('validates puzzleId range', async () => {
    await expect(recordChallengeAttempt(0, true, 1000, 1, [])).rejects.toThrow(RangeError);
    await expect(recordChallengeAttempt(101, true, 1000, 1, [])).rejects.toThrow(
      RangeError,
    );
    await expect(recordChallengeAttempt(1.5, true, 1000, 1, [])).rejects.toThrow(
      RangeError,
    );
  });

  it('validates rating range', async () => {
    await expect(recordChallengeAttempt(1, true, 1000, -1, [])).rejects.toThrow(
      RangeError,
    );
    await expect(recordChallengeAttempt(1, true, 1000, 4, [])).rejects.toThrow(RangeError);
  });

  it('validates solveTimeMs is non-negative', async () => {
    await expect(recordChallengeAttempt(1, true, -1, 1, [])).rejects.toThrow(RangeError);
  });
});

describe('getAllChallengeRecords', () => {
  beforeEach(async () => {
    await clearChallengeHistory();
  });

  it('returns records newest-first', async () => {
    await recordChallengeAttempt(1, true, 5000, 3, []);
    await recordChallengeAttempt(2, true, 6000, 2, []);
    await recordChallengeAttempt(3, true, 7000, 1, []);

    const records = await getAllChallengeRecords();
    expect(records).toHaveLength(3);
    expect(at(records, 0).completedAt).toBeGreaterThanOrEqual(at(records, 1).completedAt);
    expect(at(records, 1).completedAt).toBeGreaterThanOrEqual(at(records, 2).completedAt);
  });

  it('returns empty array when no records exist', async () => {
    const records = await getAllChallengeRecords();
    expect(records).toEqual([]);
  });
});

describe('getRecordsForPuzzle', () => {
  beforeEach(async () => {
    await clearChallengeHistory();
  });

  it('returns only matching records sorted by attemptNumber', async () => {
    await recordChallengeAttempt(1, true, 5000, 3, []);
    await recordChallengeAttempt(2, true, 6000, 2, []);
    await recordChallengeAttempt(2, false, 0, 0, []);
    await recordChallengeAttempt(3, true, 7000, 1, []);

    const records = await getRecordsForPuzzle(2);
    expect(records).toHaveLength(2);
    expect(at(records, 0).puzzleId).toBe(2);
    expect(at(records, 1).puzzleId).toBe(2);
    expect(at(records, 0).attemptNumber).toBe(1);
    expect(at(records, 1).attemptNumber).toBe(2);
  });

  it('returns empty array for unplayed puzzle', async () => {
    const records = await getRecordsForPuzzle(50);
    expect(records).toEqual([]);
  });
});

describe('getBestForPuzzle', () => {
  beforeEach(async () => {
    await clearChallengeHistory();
  });

  it('returns fastest solved attempt', async () => {
    await recordChallengeAttempt(5, true, 15000, 1, []);
    await recordChallengeAttempt(5, true, 8000, 3, []);
    await recordChallengeAttempt(5, true, 12000, 2, []);

    const best = await getBestForPuzzle(5);
    expect(best).not.toBeNull();
    if (best === null) throw new Error('Expected non-null');
    expect(best.solveTimeMs).toBe(8000);
  });

  it('returns null for unsolved puzzle', async () => {
    await recordChallengeAttempt(5, false, 0, 0, []);
    await recordChallengeAttempt(5, false, 0, 0, []);

    const best = await getBestForPuzzle(5);
    expect(best).toBeNull();
  });

  it('ignores unsolved attempts', async () => {
    await recordChallengeAttempt(5, false, 0, 0, []);
    await recordChallengeAttempt(5, true, 12000, 2, []);

    const best = await getBestForPuzzle(5);
    expect(best).not.toBeNull();
    if (best === null) throw new Error('Expected non-null');
    expect(best.solveTimeMs).toBe(12000);
    expect(best.solved).toBe(true);
  });
});

describe('getChallengesCompletedCount', () => {
  beforeEach(async () => {
    await clearChallengeHistory();
  });

  it('counts distinct solved puzzles', async () => {
    await recordChallengeAttempt(1, true, 5000, 3, []);
    await recordChallengeAttempt(2, true, 6000, 2, []);
    await recordChallengeAttempt(2, true, 5500, 3, []); // retry of puzzle 2
    await recordChallengeAttempt(3, false, 0, 0, []); // unsolved

    const count = await getChallengesCompletedCount();
    expect(count).toBe(2);
  });

  it('returns 0 when no records exist', async () => {
    const count = await getChallengesCompletedCount();
    expect(count).toBe(0);
  });
});

describe('getChallengeRecordCount', () => {
  beforeEach(async () => {
    await clearChallengeHistory();
  });

  it('returns total records', async () => {
    await recordChallengeAttempt(1, true, 5000, 3, []);
    await recordChallengeAttempt(1, true, 4000, 3, []);
    await recordChallengeAttempt(2, false, 0, 0, []);
    await recordChallengeAttempt(3, true, 7000, 1, []);
    await recordChallengeAttempt(3, false, 0, 0, []);
    await recordChallengeAttempt(4, true, 3000, 3, []);
    await recordChallengeAttempt(5, false, 0, 0, []);

    const count = await getChallengeRecordCount();
    expect(count).toBe(7);
  });
});

describe('clearChallengeHistory', () => {
  it('removes all records', async () => {
    await recordChallengeAttempt(1, true, 5000, 3, []);
    await recordChallengeAttempt(2, true, 6000, 2, []);
    await clearChallengeHistory();
    expect(await getChallengeRecordCount()).toBe(0);
    expect(await getAllChallengeRecords()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ChallengeProgressSnapshot Tests (9.3)
// ---------------------------------------------------------------------------

describe('computeChallengeProgress', () => {
  it('returns zero-state with no records', () => {
    const snapshot = computeChallengeProgress([]);
    expect(snapshot.puzzlesCompleted).toBe(0);
    expect(snapshot.nextPuzzleId).toBe(1);
    expect(snapshot.averageRating).toBe(0);
    expect(snapshot.bestTimeMs).toBeNull();
    expect(snapshot.currentStreak).toBe(0);
    expect(snapshot.perPuzzle.size).toBe(0);
    expect(snapshot.totalAttempts).toBe(0);
  });

  it('counts distinct solved puzzles', () => {
    const records = [
      makeRecord({ puzzleId: 1, solved: true, solveTimeMs: 5000, rating: 3, attemptNumber: 1 }),
      makeRecord({ puzzleId: 2, solved: true, solveTimeMs: 6000, rating: 2, attemptNumber: 1 }),
      makeRecord({ puzzleId: 2, solved: true, solveTimeMs: 5500, rating: 3, attemptNumber: 2 }),
      makeRecord({ puzzleId: 3, solved: false, attemptNumber: 1 }),
    ];
    const snapshot = computeChallengeProgress(records);
    expect(snapshot.puzzlesCompleted).toBe(2);
  });

  it('computes nextPuzzleId correctly', () => {
    const records = [
      makeRecord({ puzzleId: 1, solved: true, solveTimeMs: 5000, rating: 3, attemptNumber: 1 }),
      makeRecord({ puzzleId: 2, solved: true, solveTimeMs: 6000, rating: 2, attemptNumber: 1 }),
      makeRecord({ puzzleId: 3, solved: true, solveTimeMs: 7000, rating: 1, attemptNumber: 1 }),
      makeRecord({ puzzleId: 4, solved: false, attemptNumber: 1 }),
    ];
    const snapshot = computeChallengeProgress(records);
    expect(snapshot.nextPuzzleId).toBe(4);
  });

  it('nextPuzzleId skips gaps', () => {
    const records = [
      makeRecord({ puzzleId: 1, solved: true, solveTimeMs: 5000, rating: 3, attemptNumber: 1 }),
      makeRecord({ puzzleId: 2, solved: true, solveTimeMs: 6000, rating: 2, attemptNumber: 1 }),
      makeRecord({ puzzleId: 4, solved: true, solveTimeMs: 4000, rating: 3, attemptNumber: 1 }),
      makeRecord({ puzzleId: 5, solved: true, solveTimeMs: 3000, rating: 3, attemptNumber: 1 }),
    ];
    const snapshot = computeChallengeProgress(records);
    expect(snapshot.nextPuzzleId).toBe(3);
  });

  it('nextPuzzleId is 101 when all complete', () => {
    const records = Array.from({ length: 100 }, (_, i) =>
      makeRecord({
        puzzleId: i + 1,
        solved: true,
        solveTimeMs: 5000,
        rating: 2,
        attemptNumber: 1,
      }),
    );
    const snapshot = computeChallengeProgress(records);
    expect(snapshot.nextPuzzleId).toBe(101);
  });

  it('computes averageRating from best ratings', () => {
    const records = [
      makeRecord({ puzzleId: 1, solved: true, solveTimeMs: 5000, rating: 3, attemptNumber: 1 }),
      makeRecord({ puzzleId: 2, solved: true, solveTimeMs: 6000, rating: 1, attemptNumber: 1 }),
      makeRecord({ puzzleId: 3, solved: true, solveTimeMs: 7000, rating: 2, attemptNumber: 1 }),
    ];
    const snapshot = computeChallengeProgress(records);
    expect(snapshot.averageRating).toBe(2.0);
  });

  it('bestTimeMs is minimum across all puzzles', () => {
    const records = [
      makeRecord({ puzzleId: 1, solved: true, solveTimeMs: 5000, rating: 3, attemptNumber: 1 }),
      makeRecord({ puzzleId: 2, solved: true, solveTimeMs: 3000, rating: 2, attemptNumber: 1 }),
      makeRecord({ puzzleId: 3, solved: true, solveTimeMs: 8000, rating: 1, attemptNumber: 1 }),
    ];
    const snapshot = computeChallengeProgress(records);
    expect(snapshot.bestTimeMs).toBe(3000);
  });

  it('bestTimeMs uses best per-puzzle time', () => {
    const records = [
      makeRecord({ puzzleId: 1, solved: true, solveTimeMs: 10000, rating: 1, attemptNumber: 1 }),
      makeRecord({ puzzleId: 1, solved: true, solveTimeMs: 5000, rating: 3, attemptNumber: 2 }),
    ];
    const snapshot = computeChallengeProgress(records);
    expect(snapshot.bestTimeMs).toBe(5000);
  });

  it('currentStreak counts from puzzle 1', () => {
    const records = [
      makeRecord({ puzzleId: 1, solved: true, solveTimeMs: 5000, rating: 3, attemptNumber: 1 }),
      makeRecord({ puzzleId: 2, solved: true, solveTimeMs: 6000, rating: 2, attemptNumber: 1 }),
      makeRecord({ puzzleId: 3, solved: true, solveTimeMs: 7000, rating: 1, attemptNumber: 1 }),
      makeRecord({ puzzleId: 4, solved: false, attemptNumber: 1 }),
    ];
    const snapshot = computeChallengeProgress(records);
    expect(snapshot.currentStreak).toBe(3);
  });

  it('currentStreak resets at first failure', () => {
    const records = [
      makeRecord({ puzzleId: 1, solved: true, solveTimeMs: 5000, rating: 3, attemptNumber: 1 }),
      makeRecord({ puzzleId: 2, solved: false, attemptNumber: 1 }),
      makeRecord({ puzzleId: 3, solved: true, solveTimeMs: 7000, rating: 1, attemptNumber: 1 }),
    ];
    const snapshot = computeChallengeProgress(records);
    expect(snapshot.currentStreak).toBe(1);
  });

  it('currentStreak is 0 if puzzle 1 not first-attempt solved', () => {
    const records = [
      makeRecord({ puzzleId: 1, solved: false, attemptNumber: 1 }),
      makeRecord({ puzzleId: 1, solved: true, solveTimeMs: 5000, rating: 3, attemptNumber: 2 }),
    ];
    const snapshot = computeChallengeProgress(records);
    expect(snapshot.currentStreak).toBe(0);
  });

  it('perPuzzle tracks best time and rating', () => {
    const records = [
      makeRecord({ puzzleId: 5, solved: true, solveTimeMs: 15000, rating: 1, attemptNumber: 1 }),
      makeRecord({ puzzleId: 5, solved: true, solveTimeMs: 8000, rating: 3, attemptNumber: 2 }),
    ];
    const snapshot = computeChallengeProgress(records);
    const summary = snapshot.perPuzzle.get(5);
    if (summary === undefined) throw new Error('Expected summary for puzzle 5');
    expect(summary.solved).toBe(true);
    expect(summary.bestTimeMs).toBe(8000);
    expect(summary.bestRating).toBe(3);
    expect(summary.attemptCount).toBe(2);
  });

  it('totalAttempts counts all records', () => {
    const records = Array.from({ length: 12 }, (_, i) =>
      makeRecord({ puzzleId: (i % 5) + 1, attemptNumber: Math.floor(i / 5) + 1 }),
    );
    const snapshot = computeChallengeProgress(records);
    expect(snapshot.totalAttempts).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// Incremental Update Tests (9.4)
// ---------------------------------------------------------------------------

describe('updateProgressWithNewRecord', () => {
  it('matches full recompute', () => {
    const existingRecords = [
      makeRecord({ puzzleId: 1, solved: true, solveTimeMs: 5000, rating: 3, attemptNumber: 1 }),
      makeRecord({ puzzleId: 2, solved: true, solveTimeMs: 6000, rating: 2, attemptNumber: 1 }),
      makeRecord({ puzzleId: 3, solved: false, attemptNumber: 1 }),
    ];
    const newRecord = makeRecord({
      puzzleId: 3,
      solved: true,
      solveTimeMs: 7000,
      rating: 1,
      attemptNumber: 2,
    });

    const existingSnapshot = computeChallengeProgress(existingRecords);
    const incremental = updateProgressWithNewRecord(existingSnapshot, newRecord);
    const fullRecompute = computeChallengeProgress([...existingRecords, newRecord]);

    expect(incremental.puzzlesCompleted).toBe(fullRecompute.puzzlesCompleted);
    expect(incremental.nextPuzzleId).toBe(fullRecompute.nextPuzzleId);
    expect(incremental.averageRating).toBe(fullRecompute.averageRating);
    expect(incremental.bestTimeMs).toBe(fullRecompute.bestTimeMs);
    expect(incremental.totalAttempts).toBe(fullRecompute.totalAttempts);
  });

  it('updates puzzlesCompleted on first solve', () => {
    const records = [
      makeRecord({ puzzleId: 1, solved: true, solveTimeMs: 5000, rating: 3, attemptNumber: 1 }),
      makeRecord({ puzzleId: 2, solved: true, solveTimeMs: 6000, rating: 2, attemptNumber: 1 }),
      makeRecord({ puzzleId: 3, solved: true, solveTimeMs: 7000, rating: 1, attemptNumber: 1 }),
      makeRecord({ puzzleId: 4, solved: true, solveTimeMs: 4000, rating: 3, attemptNumber: 1 }),
      makeRecord({ puzzleId: 5, solved: true, solveTimeMs: 8000, rating: 2, attemptNumber: 1 }),
    ];
    const snapshot = computeChallengeProgress(records);
    expect(snapshot.puzzlesCompleted).toBe(5);

    const newRecord = makeRecord({
      puzzleId: 6,
      solved: true,
      solveTimeMs: 3000,
      rating: 3,
      attemptNumber: 1,
    });
    const updated = updateProgressWithNewRecord(snapshot, newRecord);
    expect(updated.puzzlesCompleted).toBe(6);
  });

  it('does not double-count re-solves', () => {
    const records = [
      makeRecord({ puzzleId: 1, solved: true, solveTimeMs: 5000, rating: 3, attemptNumber: 1 }),
      makeRecord({ puzzleId: 2, solved: true, solveTimeMs: 6000, rating: 2, attemptNumber: 1 }),
      makeRecord({ puzzleId: 3, solved: true, solveTimeMs: 7000, rating: 1, attemptNumber: 1 }),
    ];
    const snapshot = computeChallengeProgress(records);
    expect(snapshot.puzzlesCompleted).toBe(3);

    const newRecord = makeRecord({
      puzzleId: 3,
      solved: true,
      solveTimeMs: 6000,
      rating: 2,
      attemptNumber: 2,
    });
    const updated = updateProgressWithNewRecord(snapshot, newRecord);
    expect(updated.puzzlesCompleted).toBe(3);
  });

  it('updates bestTimeMs when new record is faster', () => {
    const records = [
      makeRecord({ puzzleId: 1, solved: true, solveTimeMs: 5000, rating: 3, attemptNumber: 1 }),
    ];
    const snapshot = computeChallengeProgress(records);
    expect(snapshot.bestTimeMs).toBe(5000);

    const newRecord = makeRecord({
      puzzleId: 2,
      solved: true,
      solveTimeMs: 3000,
      rating: 2,
      attemptNumber: 1,
    });
    const updated = updateProgressWithNewRecord(snapshot, newRecord);
    expect(updated.bestTimeMs).toBe(3000);
  });
});

// ---------------------------------------------------------------------------
// Performance Validation Tests (9.5)
// ---------------------------------------------------------------------------

describe('performance', () => {
  it('computeChallengeProgress with 100 records completes within 50ms', () => {
    const records = Array.from({ length: 100 }, (_, i) =>
      makeRecord({
        puzzleId: i + 1,
        solved: true,
        solveTimeMs: 5000 + i * 100,
        rating: (i % 3) + 1,
        attemptNumber: 1,
      }),
    );

    const start = performance.now();
    computeChallengeProgress(records);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('computeChallengeProgress with 1000 records completes within 200ms', () => {
    const records = Array.from({ length: 1000 }, (_, i) =>
      makeRecord({
        puzzleId: (i % 100) + 1,
        solved: i % 3 !== 0,
        solveTimeMs: i % 3 !== 0 ? 3000 + (i % 10) * 500 : 0,
        rating: i % 3 !== 0 ? (i % 3) + 1 : 0,
        attemptNumber: Math.floor(i / 100) + 1,
      }),
    );

    const start = performance.now();
    computeChallengeProgress(records);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });
});
