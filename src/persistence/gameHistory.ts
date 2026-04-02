/**
 * Store and retrieve completed games in IndexedDB via the idb library.
 *
 * Each GameRecord captures the full game: players, result, move notation,
 * and compact board snapshots at every ply (for Phase 3 Cogitate replay).
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { GameState } from '../engine/types';
import { createInitialBoard } from '../engine/board';
import { createAmericanRules } from '../engine/rules';
import { moveToString } from '../utils/notation';
import { serializeBoard } from './serialization';

// ---------------------------------------------------------------------------
// Database constants
// ---------------------------------------------------------------------------

const DB_NAME = 'crazy-checkers';
const DB_VERSION = 1;
const GAMES_STORE = 'games';

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
}

// ---------------------------------------------------------------------------
// Database initialization
// ---------------------------------------------------------------------------

function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(GAMES_STORE)) {
        const store = db.createObjectStore(GAMES_STORE, { keyPath: 'id' });
        store.createIndex('by-mode', 'mode');
        store.createIndex('by-completedAt', 'completedAt');
        store.createIndex('by-result', 'result');
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
 * @returns The generated record ID.
 */
export async function recordGame(
  finalState: GameState,
  mode: string,
  startedAt: number,
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
    boardStates: buildBoardStateSnapshots(finalState),
    startedAt,
    completedAt: Date.now(),
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
  const records: GameRecord[] = await db.getAllFromIndex(GAMES_STORE, 'by-completedAt') as GameRecord[];
  return records.reverse();
}

/**
 * Retrieves a single game record by ID.
 */
export async function getGameRecord(id: string): Promise<GameRecord | undefined> {
  const db = await getDb();
  return await db.get(GAMES_STORE, id) as GameRecord | undefined;
}

/**
 * Returns the count of stored game records.
 */
export async function getGameRecordCount(): Promise<number> {
  const db = await getDb();
  return db.count(GAMES_STORE);
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
