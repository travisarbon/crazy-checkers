/**
 * Shared utilities for cross-feature integration tests (Task 24.1).
 *
 * - `runSelfPlayGame` drives a game to completion using the engine's
 *   composite rule set, with optional permanent events pre-seeded.
 * - `createSeededRandom` provides deterministic PRNG for reproducible runs.
 * - `seedChallengeRecords` / `seedGameRecord` insert mock persistence rows
 *   so progression tests can avoid replaying full games end-to-end.
 */

import '../engine/events/index';
import { createAmericanRules } from '../engine/rules';
import {
  createNewGame,
  getCurrentLegalMoves,
  makeMove,
} from '../engine/game';
import {
  CrazyEvent,
  GameMode,
  GameStatus,
  PieceColor,
  PlayerType,
  type ActiveEvent,
  type GameResult,
  type GameState,
  type Move,
  type PlayerSetup,
} from '../engine/types';
import { EVENT_METADATA_FACTORIES } from '../engine/events';
import { CompositeEventRuleSet } from '../engine/compositeRuleSet';
import {
  recordChallengeAttempt,
  type ChallengeRecord,
} from '../persistence/challengeRecords';
import {
  serializeActiveEvents,
  serializeBoard,
  type SerializedActiveEvent,
} from '../persistence/serialization';
import type { GameRecord } from '../persistence/gameHistory';
import { getDb } from '../persistence/gameHistory';

// ---------------------------------------------------------------------------
// Seeded PRNG
// ---------------------------------------------------------------------------

/** Mulberry32: small, fast deterministic PRNG returning values in [0, 1). */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Self-play driver
// ---------------------------------------------------------------------------

export interface SelfPlayOptions {
  readonly mode?: GameMode;
  readonly permanentEvents?: readonly CrazyEvent[];
  readonly players?: PlayerSetup;
  readonly maxPlies?: number;
  readonly seed?: number;
  readonly validateEveryNPlies?: number;
}

export interface SelfPlayResult {
  readonly completed: boolean;
  readonly plies: number;
  readonly result: GameResult | null;
  readonly finalState: GameState;
  readonly error: string | null;
  readonly warnings: readonly string[];
  readonly boardStates: readonly string[];
  readonly activeEventsPerPly: readonly SerializedActiveEvent[][];
}

const DEFAULT_PLAYERS: PlayerSetup = {
  white: PlayerType.Human,
  black: PlayerType.Human,
};

function seedPermanentEvents(
  state: GameState,
  events: readonly CrazyEvent[],
): GameState {
  if (events.length === 0) return state;
  const active: ActiveEvent[] = [];
  for (const type of events) {
    const factory = EVENT_METADATA_FACTORIES.get(type);
    const metadata = factory ? factory(state.board, PieceColor.White) : undefined;
    active.push({
      type,
      remainingPlies: -1,
      triggeredBy: PieceColor.White,
      triggeredAtPly: 0,
      permanent: true,
      metadata,
    });
  }
  if (state.ruleSet instanceof CompositeEventRuleSet) {
    state.ruleSet.setActiveEvents(active);
  }
  return { ...state, activeEvents: active };
}

/**
 * Drive a game to completion (or ply limit) by always selecting the first
 * legal move. Returns a structured result with captured snapshots suitable
 * for later persistence or assertions.
 */
export function runSelfPlayGame(options: SelfPlayOptions = {}): SelfPlayResult {
  const mode = options.mode ?? GameMode.Classic;
  const permanent = options.permanentEvents ?? [];
  const players = options.players ?? DEFAULT_PLAYERS;
  const maxPlies = options.maxPlies ?? 300;
  const seed = options.seed ?? 12345;
  const rng = createSeededRandom(seed);

  const warnings: string[] = [];
  const boardStates: string[] = [];
  const activeEventsPerPly: SerializedActiveEvent[][] = [];

  let state = createNewGame(createAmericanRules(), players, mode, rng);
  state = seedPermanentEvents(state, permanent);
  boardStates.push(serializeBoard(state.board));
  activeEventsPerPly.push(serializeActiveEvents(state.activeEvents));

  let plies = 0;
  let error: string | null = null;

  try {
    while (state.status === GameStatus.InProgress && plies < maxPlies) {
      const legal = getCurrentLegalMoves(state);
      if (legal.length === 0) {
        // Engine should report game over when no moves are legal; bail out
        // safely if it didn't.
        warnings.push(`no legal moves at ply ${String(plies)} but status is IN_PROGRESS`);
        break;
      }
      const move: Move = legal[0] as Move;
      state = makeMove(state, move);
      plies += 1;
      boardStates.push(serializeBoard(state.board));
      activeEventsPerPly.push(serializeActiveEvents(state.activeEvents));

      if (state.board.length !== 32) {
        warnings.push(`board length drifted to ${String(state.board.length)} at ply ${String(plies)}`);
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return {
    completed: state.status === GameStatus.GameOver,
    plies,
    result: state.result,
    finalState: state,
    error,
    warnings,
    boardStates,
    activeEventsPerPly,
  };
}

// ---------------------------------------------------------------------------
// Persistence seeding helpers
// ---------------------------------------------------------------------------

const GAMES_STORE = 'games';

/** Bulk-insert `count` solved ChallengeRecord rows with distinct puzzle IDs. */
export async function seedChallengeRecords(
  count: number,
  startingPuzzleId = 1,
): Promise<ChallengeRecord[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const puzzleId = startingPuzzleId + i;
    const id = await recordChallengeAttempt(
      puzzleId,
      true,
      1_000 + i * 100,
      3,
      [`m${String(i)}`],
    );
    ids.push(id);
  }
  // Re-read for caller convenience (records include generated metadata).
  const { getAllChallengeRecords } = await import('../persistence/challengeRecords');
  const all = await getAllChallengeRecords();
  return all.filter((r) => ids.includes(r.id));
}

export interface SeedGameRecordInput {
  readonly mode: string;
  readonly playerWhite: string;
  readonly playerBlack: string;
  readonly result: 'WHITE_WIN' | 'BLACK_WIN' | 'DRAW';
  readonly reason?: string;
  readonly moves?: readonly string[];
  readonly boardStates?: readonly string[];
  readonly startedAt?: number;
  readonly completedAt?: number;
  readonly activeEventsPerPly?: readonly SerializedActiveEvent[][];
}

/**
 * Insert a synthetic GameRecord directly into IndexedDB.
 * Useful for establishing Career stat state without running full self-play.
 */
export async function seedGameRecord(input: SeedGameRecordInput): Promise<string> {
  const now = Date.now();
  const record: GameRecord = {
    id: `seed-${String(now)}-${Math.random().toString(36).slice(2, 8)}`,
    mode: input.mode,
    playerWhite: input.playerWhite,
    playerBlack: input.playerBlack,
    result: input.result,
    reason: input.reason ?? 'simulated',
    moves: input.moves ? [...input.moves] : [],
    boardStates: input.boardStates ? [...input.boardStates] : [],
    startedAt: input.startedAt ?? now - 1_000,
    completedAt: input.completedAt ?? now,
    ...(input.activeEventsPerPly
      ? { activeEventsPerPly: input.activeEventsPerPly.map((p) => [...p]) }
      : {}),
  };
  const db = await getDb();
  await db.put(GAMES_STORE, record);
  return record.id;
}
