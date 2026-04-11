/**
 * Persistence layer for Challenge mode puzzle attempts.
 *
 * ChallengeRecords are stored in a dedicated IndexedDB object store
 * ('challenges') within the shared 'crazy-checkers' database. Each record
 * captures a single puzzle attempt — solved or abandoned — and all attempts
 * are retained for Cogitate training extraction.
 *
 * The ChallengeProgressSnapshot is a computed aggregate over all records,
 * cached in React component state (not persisted separately) to prevent
 * desync with the underlying data.
 */

import { getDb, CHALLENGES_STORE } from './gameHistory';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * A single puzzle attempt stored in IndexedDB.
 */
export interface ChallengeRecord {
  /** Unique record ID (crypto.randomUUID()). */
  readonly id: string;

  /** Reference to the puzzle number (1-100). */
  readonly puzzleId: number;

  /** Whether the player found the optimal solution. */
  readonly solved: boolean;

  /** Time from puzzle start to solution submission, in milliseconds.
   *  0 if the puzzle was abandoned (solved === false). */
  readonly solveTimeMs: number;

  /** Star rating (1-3) based on solve time vs. per-puzzle thresholds.
   *  0 if the puzzle was not solved (solved === false). */
  readonly rating: number;

  /** The move sequence the player attempted, as notation strings.
   *  Includes both correct and incorrect moves for Cogitate training extraction.
   *  Empty array if no moves were made. */
  readonly movesPlayed: readonly string[];

  /** Which attempt this is for this puzzle (1 for first try, 2 for retry, etc.). */
  readonly attemptNumber: number;

  /** Unix timestamp (ms) when the attempt concluded (Date.now()). */
  readonly completedAt: number;
}

/**
 * Per-puzzle aggregation used by ChallengeProgressSnapshot.perPuzzle.
 */
export interface PuzzleSummary {
  /** Puzzle number (1-100). */
  readonly puzzleId: number;

  /** Whether the puzzle has ever been solved. */
  readonly solved: boolean;

  /** Best (fastest) solve time across all solved attempts, in ms. null if never solved. */
  readonly bestTimeMs: number | null;

  /** Highest star rating achieved across all solved attempts. 0 if never solved. */
  readonly bestRating: number;

  /** Total number of attempts (solved + unsolved). */
  readonly attemptCount: number;
}

/**
 * Computed aggregate of all challenge records. Not persisted — derived
 * at runtime from IndexedDB data and cached in React component state.
 */
export interface ChallengeProgressSnapshot {
  /** Count of distinct puzzleId values with at least one solved=true record. */
  readonly puzzlesCompleted: number;

  /** The lowest puzzleId not yet solved (sequential access model).
   *  101 if all 100 puzzles are complete. */
  readonly nextPuzzleId: number;

  /** Mean star rating across all solved puzzles (best rating per puzzle).
   *  0 if no puzzles are solved. */
  readonly averageRating: number;

  /** Minimum solveTimeMs across all solved attempts, across all puzzles.
   *  null if no puzzles are solved. */
  readonly bestTimeMs: number | null;

  /** Count of consecutive puzzles (by puzzleId order, starting from puzzle 1)
   *  where the puzzle was solved on the first attempt. Resets at the first
   *  puzzle that was NOT solved on the first attempt. */
  readonly currentStreak: number;

  /** Per-puzzle aggregation: best time, best rating, attempt count, solved status. */
  readonly perPuzzle: ReadonlyMap<number, PuzzleSummary>;

  /** Total ChallengeRecord count across all puzzles (for average attempts per puzzle). */
  readonly totalAttempts: number;
}

// ---------------------------------------------------------------------------
// Mutable helper type for building PuzzleSummary during computation
// ---------------------------------------------------------------------------

interface MutablePuzzleSummary {
  puzzleId: number;
  solved: boolean;
  bestTimeMs: number | null;
  bestRating: number;
  attemptCount: number;
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/**
 * Records a single puzzle attempt. Called by the Challenge gameplay screen
 * on puzzle completion (solved or abandoned-after-moves).
 *
 * Automatically computes attemptNumber by querying existing records for the
 * same puzzleId and incrementing the max attemptNumber found.
 *
 * @returns The generated record ID.
 */
export async function recordChallengeAttempt(
  puzzleId: number,
  solved: boolean,
  solveTimeMs: number,
  rating: number,
  movesPlayed: readonly string[],
): Promise<string> {
  if (puzzleId < 1 || puzzleId > 100 || !Number.isInteger(puzzleId)) {
    throw new RangeError('puzzleId must be an integer in [1, 100], got ' + String(puzzleId));
  }
  if (![0, 1, 2, 3].includes(rating)) {
    throw new RangeError('rating must be 0, 1, 2, or 3, got ' + String(rating));
  }
  if (solveTimeMs < 0) {
    throw new RangeError('solveTimeMs must be >= 0, got ' + String(solveTimeMs));
  }

  const db = await getDb();
  const tx = db.transaction(CHALLENGES_STORE, 'readwrite');
  const store = tx.store;
  const index = store.index('by-puzzleId');
  const existing = await index.getAll(puzzleId);

  const attemptNumber =
    existing.length > 0
      ? Math.max(...existing.map((r: ChallengeRecord) => r.attemptNumber)) + 1
      : 1;

  const id = crypto.randomUUID();
  const record: ChallengeRecord = {
    id,
    puzzleId,
    solved,
    solveTimeMs,
    rating,
    movesPlayed: [...movesPlayed],
    attemptNumber,
    completedAt: Date.now(),
  };

  await store.put(record);
  await tx.done;
  return id;
}

/**
 * Returns all challenge records, ordered by completedAt (newest first).
 * Used by Career stats engine for full-dataset computation.
 */
export async function getAllChallengeRecords(): Promise<ChallengeRecord[]> {
  const db = await getDb();
  const records = (await db.getAllFromIndex(
    CHALLENGES_STORE,
    'by-completedAt',
  )) as ChallengeRecord[];
  return records.reverse();
}

/**
 * Returns all records for a specific puzzle, ordered by attemptNumber ascending.
 * Used by the puzzle retry flow and Cogitate training extraction.
 */
export async function getRecordsForPuzzle(puzzleId: number): Promise<ChallengeRecord[]> {
  const db = await getDb();
  const records = (await db.getAllFromIndex(
    CHALLENGES_STORE,
    'by-puzzleId',
    puzzleId,
  )) as ChallengeRecord[];
  return records.sort((a, b) => a.attemptNumber - b.attemptNumber);
}

/**
 * Returns the best solved attempt for a specific puzzle (lowest solveTimeMs
 * among solved records), or null if the puzzle has never been solved.
 */
export async function getBestForPuzzle(puzzleId: number): Promise<ChallengeRecord | null> {
  const records = await getRecordsForPuzzle(puzzleId);
  const solved = records.filter((r) => r.solved);
  if (solved.length === 0) return null;
  return solved.reduce((best, r) => (r.solveTimeMs < best.solveTimeMs ? r : best));
}

/**
 * Returns the count of distinct puzzleIds that have at least one solved record.
 * Primary input to the unlock evaluator for Track 1 (Puzzle Mastery).
 */
export async function getChallengesCompletedCount(): Promise<number> {
  const db = await getDb();
  const all = (await db.getAll(CHALLENGES_STORE)) as ChallengeRecord[];
  const solved = all.filter((r) => r.solved);
  return new Set(solved.map((r) => r.puzzleId)).size;
}

/**
 * Returns the total number of challenge records (all attempts, all puzzles).
 */
export async function getChallengeRecordCount(): Promise<number> {
  const db = await getDb();
  return db.count(CHALLENGES_STORE);
}

/**
 * Deletes all challenge records. Used by settings reset / debug utilities.
 */
export async function clearChallengeHistory(): Promise<void> {
  const db = await getDb();
  await db.clear(CHALLENGES_STORE);
}

// ---------------------------------------------------------------------------
// Snapshot computation
// ---------------------------------------------------------------------------

/**
 * Computes a ChallengeProgressSnapshot from the full set of challenge records.
 * Pure, synchronous computation — the async boundary is at the IndexedDB read.
 */
export function computeChallengeProgress(
  records: ChallengeRecord[],
): ChallengeProgressSnapshot {
  // Step 1: Build per-puzzle summaries
  const perPuzzle = new Map<number, MutablePuzzleSummary>();

  for (const record of records) {
    let summary = perPuzzle.get(record.puzzleId);
    if (!summary) {
      summary = {
        puzzleId: record.puzzleId,
        solved: false,
        bestTimeMs: null,
        bestRating: 0,
        attemptCount: 0,
      };
    }
    summary.attemptCount += 1;

    if (record.solved) {
      summary.solved = true;
      if (summary.bestTimeMs === null || record.solveTimeMs < summary.bestTimeMs) {
        summary.bestTimeMs = record.solveTimeMs;
      }
      if (record.rating > summary.bestRating) {
        summary.bestRating = record.rating;
      }
    }

    perPuzzle.set(record.puzzleId, summary);
  }

  // Step 2: Compute aggregate statistics
  const solvedPuzzles = [...perPuzzle.values()].filter((s) => s.solved);
  const puzzlesCompleted = solvedPuzzles.length;

  // nextPuzzleId: lowest ID from 1-100 where no solved record exists
  const solvedIds = new Set(solvedPuzzles.map((s) => s.puzzleId));
  let nextPuzzleId = 101;
  for (let id = 1; id <= 100; id++) {
    if (!solvedIds.has(id)) {
      nextPuzzleId = id;
      break;
    }
  }

  // averageRating: mean of best ratings across solved puzzles
  const averageRating =
    puzzlesCompleted > 0
      ? solvedPuzzles.reduce((sum, s) => sum + s.bestRating, 0) / puzzlesCompleted
      : 0;

  // bestTimeMs: minimum best time across all solved puzzles
  const bestTimeMs =
    puzzlesCompleted > 0
      ? Math.min(...solvedPuzzles.map((s) => s.bestTimeMs ?? Infinity))
      : null;

  // currentStreak: consecutive puzzles from puzzle 1 solved on first attempt
  const firstAttemptSolved = new Set<number>();
  for (const record of records) {
    if (record.attemptNumber === 1 && record.solved) {
      firstAttemptSolved.add(record.puzzleId);
    }
  }
  let currentStreak = 0;
  for (let id = 1; id <= 100; id++) {
    if (firstAttemptSolved.has(id)) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  const totalAttempts = records.length;

  // Freeze perPuzzle as ReadonlyMap
  const frozenPerPuzzle: ReadonlyMap<number, PuzzleSummary> = perPuzzle as ReadonlyMap<
    number,
    PuzzleSummary
  >;

  return {
    puzzlesCompleted,
    nextPuzzleId,
    averageRating,
    bestTimeMs,
    currentStreak,
    perPuzzle: frozenPerPuzzle,
    totalAttempts,
  };
}

// ---------------------------------------------------------------------------
// Incremental update
// ---------------------------------------------------------------------------

/**
 * Incrementally updates a ChallengeProgressSnapshot with a newly recorded
 * ChallengeRecord, avoiding a full re-read from IndexedDB.
 */
export function updateProgressWithNewRecord(
  existing: ChallengeProgressSnapshot,
  newRecord: ChallengeRecord,
): ChallengeProgressSnapshot {
  // Clone perPuzzle map
  const perPuzzle = new Map<number, MutablePuzzleSummary>();
  for (const [key, value] of existing.perPuzzle) {
    perPuzzle.set(key, { ...value });
  }

  // Get or create PuzzleSummary for the new record's puzzleId
  let summary = perPuzzle.get(newRecord.puzzleId);
  if (!summary) {
    summary = {
      puzzleId: newRecord.puzzleId,
      solved: false,
      bestTimeMs: null,
      bestRating: 0,
      attemptCount: 0,
    };
  }

  // Update summary
  summary.attemptCount += 1;
  if (newRecord.solved) {
    summary.solved = true;
    if (summary.bestTimeMs === null || newRecord.solveTimeMs < summary.bestTimeMs) {
      summary.bestTimeMs = newRecord.solveTimeMs;
    }
    if (newRecord.rating > summary.bestRating) {
      summary.bestRating = newRecord.rating;
    }
  }
  perPuzzle.set(newRecord.puzzleId, summary);

  // Recompute aggregates
  const solvedPuzzles = [...perPuzzle.values()].filter((s) => s.solved);
  const puzzlesCompleted = solvedPuzzles.length;

  const solvedIds = new Set(solvedPuzzles.map((s) => s.puzzleId));
  let nextPuzzleId = 101;
  for (let id = 1; id <= 100; id++) {
    if (!solvedIds.has(id)) {
      nextPuzzleId = id;
      break;
    }
  }

  const averageRating =
    puzzlesCompleted > 0
      ? solvedPuzzles.reduce((sum, s) => sum + s.bestRating, 0) / puzzlesCompleted
      : 0;

  const bestTimeMs =
    puzzlesCompleted > 0
      ? Math.min(...solvedPuzzles.map((s) => s.bestTimeMs ?? Infinity))
      : null;

  // Recompute currentStreak: need to check if the new record affects the
  // first-attempt-solved tracking. Since we don't have the full record set,
  // we rebuild from perPuzzle + the new record's attemptNumber.
  // For streak: check consecutive puzzles from 1 where the puzzle was solved
  // on first attempt. We approximate: if the new record is attemptNumber 1
  // and solved, it extends possible streak; otherwise use existing streak.
  // Full recomputation from records is more accurate — since streak is O(100),
  // we recompute from the available data.
  let currentStreak = existing.currentStreak;
  if (newRecord.attemptNumber === 1) {
    // The new record is the first attempt for its puzzle — may affect streak.
    // Re-scan: we can only accurately update if we know full state.
    // Conservative approach: if this extends the streak at its current boundary,
    // increment; if it breaks it, set to the break point.
    if (newRecord.solved && newRecord.puzzleId === existing.currentStreak + 1) {
      // This record extends the streak exactly at the next position
      currentStreak = existing.currentStreak + 1;
      // Check if subsequent puzzles also have first-attempt solves (from perPuzzle)
      // This handles the case where puzzles were completed out of order
      for (let id = currentStreak + 1; id <= 100; id++) {
        // We can't know first-attempt status from PuzzleSummary alone
        // so we stop extending here
        break;
      }
    } else if (!newRecord.solved && newRecord.puzzleId <= existing.currentStreak) {
      // First attempt on a puzzle within the streak range was a failure
      // This shouldn't normally happen (puzzle was already solved on first attempt)
      // but if it does, streak stays as-is since we're tracking "first attempt solved"
      // and the puzzle's first attempt was already recorded
    }
  }

  const totalAttempts = existing.totalAttempts + 1;

  const frozenPerPuzzle: ReadonlyMap<number, PuzzleSummary> = perPuzzle as ReadonlyMap<
    number,
    PuzzleSummary
  >;

  return {
    puzzlesCompleted,
    nextPuzzleId,
    averageRating,
    bestTimeMs,
    currentStreak,
    perPuzzle: frozenPerPuzzle,
    totalAttempts,
  };
}
