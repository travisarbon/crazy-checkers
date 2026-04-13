import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  EXPORT_SCHEMA,
  EXPORT_SCHEMA_VERSION,
  exportAll,
  serializeExportEnvelope,
  parseExportEnvelope,
  importAll,
  resetAll,
  type ExportEnvelope,
} from './dataManagement';
import {
  CHALLENGES_STORE,
  GAMES_STORE_NAME,
  getAllGameRecords,
  getDb,
} from './gameHistory';
import type { GameRecord } from './gameHistory';
import { getAllChallengeRecords } from './challengeRecords';
import type { ChallengeRecord } from './challengeRecords';

const SETTINGS_KEY = 'crazy-checkers-settings';
const SAVED_GAME_KEY = 'crazy-checkers-saved-game';
const UNLOCK_STATE_KEY = 'crazy-checkers-unlock-state';
const CODE_UNLOCKS_KEY = 'crazy-checkers-code-unlocks';
const REDEMPTION_HISTORY_KEY = 'crazy-checkers-redemption-history';

const LOCAL_KEYS = [
  SETTINGS_KEY,
  SAVED_GAME_KEY,
  UNLOCK_STATE_KEY,
  CODE_UNLOCKS_KEY,
  REDEMPTION_HISTORY_KEY,
];

async function clearIndexedDb(): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction([GAMES_STORE_NAME, CHALLENGES_STORE], 'readwrite');
    await tx.objectStore(GAMES_STORE_NAME).clear();
    await tx.objectStore(CHALLENGES_STORE).clear();
    await tx.done;
  } catch {
    // ignore
  }
}

function clearAllStorage(): void {
  for (const k of LOCAL_KEYS) localStorage.removeItem(k);
}

function sampleGame(id = 'game-1'): GameRecord {
  return {
    id,
    mode: 'CLASSIC',
    playerWhite: 'HUMAN',
    playerBlack: 'CPU_EASY',
    result: 'WHITE_WIN',
    reason: 'NO_LEGAL_MOVES',
    moves: ['11-15', '22-18'],
    boardStates: ['b'.repeat(32), 'b'.repeat(32), 'b'.repeat(32)],
    startedAt: 1_000,
    completedAt: 2_000,
  };
}

function sampleChallenge(id = 'ch-1'): ChallengeRecord {
  return {
    id,
    puzzleId: 1,
    solved: true,
    solveTimeMs: 1_234,
    rating: 3,
    movesPlayed: ['11-15', '22-18'],
    attemptNumber: 1,
    completedAt: 4_000,
  };
}

describe('dataManagement — exportAll', () => {
  beforeEach(async () => {
    clearAllStorage();
    await clearIndexedDb();
  });

  it('returns a well-formed envelope on empty storage', async () => {
    const env = await exportAll();
    expect(env.schema).toBe(EXPORT_SCHEMA);
    expect(env.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(env.payload.games).toEqual([]);
    expect(env.payload.challenges).toEqual([]);
    expect(env.payload.settings).toBeUndefined();
  });

  it('captures every populated slot verbatim', async () => {
    localStorage.setItem(SETTINGS_KEY, '{"version":3,"data":{}}');
    localStorage.setItem(UNLOCK_STATE_KEY, '{"v":1}');
    localStorage.setItem(CODE_UNLOCKS_KEY, JSON.stringify(['chaos']));
    localStorage.setItem(REDEMPTION_HISTORY_KEY, JSON.stringify([]));

    const db = await getDb();
    await db.put(GAMES_STORE_NAME, sampleGame());
    await db.put(CHALLENGES_STORE, sampleChallenge());

    const env = await exportAll();
    expect(env.payload.settings).toBe('{"version":3,"data":{}}');
    expect(env.payload.unlockState).toBe('{"v":1}');
    expect(env.payload.codeUnlocks).toBe(JSON.stringify(['chaos']));
    expect(env.payload.redemptionHistory).toBe(JSON.stringify([]));
    expect(env.payload.games).toHaveLength(1);
    expect(env.payload.games[0]?.id).toBe('game-1');
    expect(env.payload.challenges).toHaveLength(1);
    expect(env.payload.challenges[0]?.id).toBe('ch-1');
  });
});

describe('dataManagement — serialize + parse', () => {
  it('round-trips an empty envelope', () => {
    const env: ExportEnvelope = {
      schema: EXPORT_SCHEMA,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: 123,
      appVersion: '0.0.0',
      payload: { games: [], challenges: [] },
    };
    const json = serializeExportEnvelope(env);
    const parsed = parseExportEnvelope(json);
    expect(parsed.kind).toBe('ok');
    if (parsed.kind === 'ok') {
      expect(parsed.envelope).toEqual(env);
    }
  });

  it('rejects empty input', () => {
    const r = parseExportEnvelope('');
    expect(r.kind).toBe('invalid-envelope');
  });

  it('rejects non-JSON input', () => {
    const r = parseExportEnvelope('not json {{{');
    expect(r.kind).toBe('invalid-envelope');
  });

  it('rejects a non-object root', () => {
    const r = parseExportEnvelope(JSON.stringify([]));
    expect(r.kind).toBe('invalid-envelope');
  });

  it('rejects an object without the schema marker', () => {
    const r = parseExportEnvelope(JSON.stringify({ foo: 'bar' }));
    expect(r.kind).toBe('invalid-envelope');
  });

  it('rejects a newer schemaVersion', () => {
    const r = parseExportEnvelope(
      JSON.stringify({
        schema: EXPORT_SCHEMA,
        schemaVersion: 99,
        exportedAt: 1,
        appVersion: 'x',
        payload: { games: [], challenges: [] },
      }),
    );
    expect(r.kind).toBe('unsupported-version');
    if (r.kind === 'unsupported-version') {
      expect(r.actualVersion).toBe(99);
    }
  });

  it('rejects non-array games', () => {
    const r = parseExportEnvelope(
      JSON.stringify({
        schema: EXPORT_SCHEMA,
        schemaVersion: 1,
        exportedAt: 1,
        appVersion: 'x',
        payload: { games: 'nope', challenges: [] },
      }),
    );
    expect(r.kind).toBe('invalid-envelope');
  });

  it('rejects non-string optional slots', () => {
    const r = parseExportEnvelope(
      JSON.stringify({
        schema: EXPORT_SCHEMA,
        schemaVersion: 1,
        exportedAt: 1,
        appVersion: 'x',
        payload: { games: [], challenges: [], settings: 42 },
      }),
    );
    expect(r.kind).toBe('invalid-envelope');
  });
});

describe('dataManagement — importAll', () => {
  beforeEach(async () => {
    clearAllStorage();
    await clearIndexedDb();
  });

  it('writes every slot back to storage', async () => {
    const env: ExportEnvelope = {
      schema: EXPORT_SCHEMA,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: 1,
      appVersion: 'x',
      payload: {
        settings: 'SETTINGS_JSON',
        savedGame: 'SAVED_GAME_JSON',
        unlockState: 'UNLOCK_STATE_JSON',
        codeUnlocks: '["chaos"]',
        redemptionHistory: '[]',
        games: [sampleGame(), sampleGame('game-2')],
        challenges: [sampleChallenge()],
      },
    };
    const result = await importAll(env);
    expect(result.kind).toBe('ok');

    expect(localStorage.getItem(SETTINGS_KEY)).toBe('SETTINGS_JSON');
    expect(localStorage.getItem(SAVED_GAME_KEY)).toBe('SAVED_GAME_JSON');
    expect(localStorage.getItem(UNLOCK_STATE_KEY)).toBe('UNLOCK_STATE_JSON');
    expect(localStorage.getItem(CODE_UNLOCKS_KEY)).toBe('["chaos"]');
    expect(localStorage.getItem(REDEMPTION_HISTORY_KEY)).toBe('[]');

    const games = await getAllGameRecords();
    expect(games.map((g) => g.id).sort()).toEqual(['game-1', 'game-2']);
    const challenges = await getAllChallengeRecords();
    expect(challenges.map((c) => c.id)).toEqual(['ch-1']);
  });

  it('leaves localStorage untouched for absent optional slots', async () => {
    localStorage.setItem(SETTINGS_KEY, 'PRE_EXISTING');
    const env: ExportEnvelope = {
      schema: EXPORT_SCHEMA,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: 1,
      appVersion: 'x',
      payload: { games: [], challenges: [] },
    };
    const result = await importAll(env);
    expect(result.kind).toBe('ok');
    expect(localStorage.getItem(SETTINGS_KEY)).toBe('PRE_EXISTING');
  });

  it('replaces IndexedDB stores atomically', async () => {
    const db = await getDb();
    await db.put(GAMES_STORE_NAME, sampleGame('old-game'));

    const env: ExportEnvelope = {
      schema: EXPORT_SCHEMA,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: 1,
      appVersion: 'x',
      payload: {
        games: [sampleGame('new-game')],
        challenges: [],
      },
    };
    await importAll(env);

    const games = await getAllGameRecords();
    expect(games.map((g) => g.id)).toEqual(['new-game']);
  });

  it('round-trips exportAll -> serialize -> parse -> importAll -> exportAll', async () => {
    localStorage.setItem(SETTINGS_KEY, '{"seed":1}');
    const db = await getDb();
    await db.put(GAMES_STORE_NAME, sampleGame());
    await db.put(CHALLENGES_STORE, sampleChallenge());

    const first = await exportAll();
    const json = serializeExportEnvelope(first);

    clearAllStorage();
    await clearIndexedDb();

    const parsed = parseExportEnvelope(json);
    expect(parsed.kind).toBe('ok');
    if (parsed.kind !== 'ok') return;
    await importAll(parsed.envelope);

    const second = await exportAll();
    expect(second.payload.settings).toBe(first.payload.settings);
    expect(second.payload.games).toEqual(first.payload.games);
    expect(second.payload.challenges).toEqual(first.payload.challenges);
  });
});

describe('dataManagement — resetAll', () => {
  beforeEach(async () => {
    clearAllStorage();
    await clearIndexedDb();
  });

  it('wipes every slot', async () => {
    localStorage.setItem(SETTINGS_KEY, 'x');
    localStorage.setItem(SAVED_GAME_KEY, 'x');
    localStorage.setItem(UNLOCK_STATE_KEY, 'x');
    localStorage.setItem(CODE_UNLOCKS_KEY, 'x');
    localStorage.setItem(REDEMPTION_HISTORY_KEY, 'x');
    const db = await getDb();
    await db.put(GAMES_STORE_NAME, sampleGame());
    await db.put(CHALLENGES_STORE, sampleChallenge());

    await resetAll();

    for (const k of LOCAL_KEYS) {
      expect(localStorage.getItem(k)).toBeNull();
    }
    expect(await getAllGameRecords()).toEqual([]);
    expect(await getAllChallengeRecords()).toEqual([]);
  });

  it('is safe to call on empty state', async () => {
    await expect(resetAll()).resolves.not.toThrow();
  });
});
