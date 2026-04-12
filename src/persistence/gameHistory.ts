/**
 * Store and retrieve completed games in IndexedDB via the idb library.
 *
 * Each GameRecord captures the full game: players, result, move notation,
 * and compact board snapshots at every ply (for Phase 3 Cogitate replay).
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { GameState } from '../engine/types';
import type { SerializedActiveEvent } from './serialization';
import type { AnalysisResult } from '../cogitate/types';
import { createInitialBoard } from '../engine/board';
import { createAmericanRules } from '../engine/rules';
import { moveToString } from '../utils/notation';
import { serializeBoard } from './serialization';

// ---------------------------------------------------------------------------
// Database constants
// ---------------------------------------------------------------------------

const DB_NAME = 'crazy-checkers';
const DB_VERSION = 3;
const GAMES_STORE = 'games';
export const CHALLENGES_STORE = 'challenges';

// ---------------------------------------------------------------------------
// GameRecord schema
// ---------------------------------------------------------------------------

/**
 * A completed game record stored in IndexedDB.
 */
export interface GameRecord {
  id: string;
  mode: string;
  playerWhite: string;
  playerBlack: string;
  result: string;
  reason: string;
  moves: string[];
  /** Compact board state at each ply (index 0 = initial, index N = after move N-1). */
  boardStates: string[];
  startedAt: number;
  completedAt: number;

  /** Per-ply active event snapshots (index 0 = initial, index N = after move N-1). */
  activeEventsPerPly?: SerializedActiveEvent[][];

  /** Log of event triggers: which event fired on which ply. */
  eventTriggerLog?: Array<{ ply: number; event: string; triggeredBy: string }>;

  /** Cached analysis results per ply, populated by the Analysis tool. */
  analysisCache?: AnalysisResult[];
  /** Ply indices identified as training positions, sorted by eval drop descending. */
  trainingPositions?: number[];
}

export const GAMES_STORE_NAME = GAMES_STORE;

/** Persists a partial update to an existing GameRecord. */
export async function updateGameRecord(
  id: string,
  patch: Partial<GameRecord>,
): Promise<void> {
  const db = await getDb();
  const existing = (await db.get(GAMES_STORE, id)) as GameRecord | undefined;
  if (!existing) return;
  const next: GameRecord = { ...existing, ...patch, id: existing.id };
  await db.put(GAMES_STORE, next);
}

// ---------------------------------------------------------------------------
// Database initialization
// ---------------------------------------------------------------------------

export function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore(GAMES_STORE, { keyPath: 'id' });
        store.createIndex('by-mode', 'mode');
        store.createIndex('by-completedAt', 'completedAt');
        store.createIndex('by-result', 'result');
      }
      // Version 2: added optional activeEventsPerPly and eventTriggerLog
      // fields to GameRecord. No schema migration needed — new fields are
      // optional and existing records load without them.

      if (oldVersion < 3) {
        const challengeStore = db.createObjectStore(CHALLENGES_STORE, { keyPath: 'id' });
        challengeStore.createIndex('by-puzzleId', 'puzzleId');
        challengeStore.createIndex('by-completedAt', 'completedAt');
      }
    },
  });
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/**
 * Records a completed game in IndexedDB.
 *
 * @param finalState - The GameState at game-over.
 * @param mode - The game mode (e.g., 'classic').
 * @param startedAt - Timestamp when the game began.
 * @param preBuiltSnapshots - Optional pre-built board state snapshots captured
 *   during gameplay. Required for Crazy/Choice/Chaos modes where events modify
 *   the board in ways that can't be reconstructed from move history alone.
 *   If omitted, snapshots are reconstructed from moves (Classic mode fallback).
 * @returns The generated record ID.
 */
export async function recordGame(
  finalState: GameState,
  mode: string,
  startedAt: number,
  preBuiltSnapshots?: string[],
  activeEventsPerPly?: SerializedActiveEvent[][],
  eventTriggerLog?: Array<{ ply: number; event: string; triggeredBy: string }>,
): Promise<string> {
  if (finalState.result === null) {
    throw new Error('Cannot record a game that has no result.');
  }

  const record: GameRecord = {
    id: crypto.randomUUID(),
    mode,
    playerWhite: finalState.players.white,
    playerBlack: finalState.players.black,
    result: finalState.result.type,
    reason: finalState.result.reason,
    moves: finalState.moveHistory.map((m) => moveToString(m)),
    boardStates: preBuiltSnapshots ?? buildBoardStateSnapshots(finalState),
    startedAt,
    completedAt: Date.now(),
    ...(activeEventsPerPly ? { activeEventsPerPly } : {}),
    ...(eventTriggerLog ? { eventTriggerLog } : {}),
  };

  const db = await getDb();
  await db.put(GAMES_STORE, record);
  return record.id;
}

/**
 * Retrieves all game records, ordered by completion time (newest first).
 */
export async function getAllGameRecords(): Promise<GameRecord[]> {
  const db = await getDb();
  const records: GameRecord[] = (await db.getAllFromIndex(
    GAMES_STORE,
    'by-completedAt',
  )) as GameRecord[];
  return records.reverse();
}

/**
 * Retrieves a single game record by ID.
 */
export async function getGameRecord(id: string): Promise<GameRecord | undefined> {
  const db = await getDb();
  return (await db.get(GAMES_STORE, id)) as GameRecord | undefined;
}

/**
 * Returns the count of stored game records.
 */
export async function getGameRecordCount(): Promise<number> {
  const db = await getDb();
  return db.count(GAMES_STORE);
}

/**
 * Returns true as soon as any stored game record has a non-empty
 * `trainingPositions` array. Iterates records via cursor and short-circuits.
 */
export async function hasAnalyzedGamesWithTrainingPositions(): Promise<boolean> {
  const db = await getDb();
  const tx = db.transaction(GAMES_STORE, 'readonly');
  const store = tx.objectStore(GAMES_STORE);
  let cursor = await store.openCursor();
  while (cursor) {
    const record = cursor.value as GameRecord;
    if (record.trainingPositions && record.trainingPositions.length > 0) {
      return true;
    }
    cursor = await cursor.continue();
  }
  return false;
}

/**
 * Deletes all game records.
 */
export async function clearGameHistory(): Promise<void> {
  const db = await getDb();
  await db.clear(GAMES_STORE);
}

// ---------------------------------------------------------------------------
// Board state snapshot builder
// ---------------------------------------------------------------------------

/**
 * Reconstructs the board state at every ply from the move history.
 * Returns an array of compact 32-char board strings.
 */
function buildBoardStateSnapshots(finalState: GameState): string[] {
  const ruleSet = createAmericanRules();
  let board = createInitialBoard();
  const snapshots: string[] = [serializeBoard(board)];

  for (const move of finalState.moveHistory) {
    board = ruleSet.applyMove(board, move);
    snapshots.push(serializeBoard(board));
  }

  return snapshots;
}
