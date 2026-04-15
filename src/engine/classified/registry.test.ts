import { beforeEach, describe, expect, it } from 'vitest';
import {
  _clearClassifiedRegistry,
  getClassifiedGame,
  getClassifiedGameByClassifiedNumber,
  getClassifiedGames,
  getClassifiedGamesByFamily,
  getClassifiedGamesByTier,
  getClassifiedGamesByWave,
  isClassifiedRegistered,
  listClassifiedGameIds,
  registerClassifiedGame,
} from './registry';
import { asClassifiedGameId } from './ClassifiedRuleSet';
import type { ClassifiedRegistrationSpec } from './registrationSpec';
import { ClassifiedRegistrationError } from './registrationSpec';
import type { ClassifiedRegistrationSpec as Spec } from './registrationSpec';
import { asAudioPackId } from './pieceVocabulary';
import { testCheckersCloneRuleSet } from './tier0/testCheckersClone';
import {
  hasAdapter,
  getAdapter,
} from '../../cogitate/CogitateGameAdapter';
import { getMode } from '../../persistence/gameModeRegistry';

function fixtureSpec(overrides: Partial<Spec> = {}): Spec {
  const gameId = overrides.gameId ?? asClassifiedGameId('russian-draughts');
  return {
    gameId,
    classifiedNumber: 1,
    wave: 1,
    tier: 1,
    family: 'Draughts',
    displayName: 'Russian Draughts',
    ruleSet: { ...testCheckersCloneRuleSet, gameId },
    boardGeometry: testCheckersCloneRuleSet.boardGeometry,
    pieceVocabularyId: testCheckersCloneRuleSet.pieceVocabulary.id,
    audioPackId: asAudioPackId('default-draughts'),
    codeUnlockKey: 'CLASSIFIED01',
    narrativeFlavor: { wave: 'Wave 1', family: 'Draughts', connection: '' },
    ...overrides,
  };
}

beforeEach(() => {
  _clearClassifiedRegistry();
});

// Silence unused-import warnings for the re-exported alias.
void ({} as ClassifiedRegistrationSpec);

describe('registerClassifiedGame — happy path', () => {
  it('stores a spec and returns a frozen entry with modeId', () => {
    const entry = registerClassifiedGame(fixtureSpec());
    expect(entry.modeId).toBe('classified-russian-draughts');
    expect(entry.classifiedNumber).toBe(1);
    expect(Object.isFrozen(entry)).toBe(true);
  });

  it('populates the GameModeRegistry with category=classified and implemented=true', () => {
    registerClassifiedGame(fixtureSpec());
    const mode = getMode('classified-russian-draughts');
    expect(mode?.category).toBe('classified');
    expect(mode?.implemented).toBe(true);
  });

  it('registers a default CogitateGameAdapter keyed by modeId', () => {
    registerClassifiedGame(fixtureSpec());
    expect(hasAdapter('classified-russian-draughts')).toBe(true);
    const adapter = getAdapter('classified-russian-draughts');
    expect(adapter?.modeId).toBe('classified-russian-draughts');
  });
});

describe('registerClassifiedGame — read surface', () => {
  it('getClassifiedGame returns the entry by branded id', () => {
    registerClassifiedGame(fixtureSpec());
    const got = getClassifiedGame(asClassifiedGameId('russian-draughts'));
    expect(got?.displayName).toBe('Russian Draughts');
  });

  it('getClassifiedGameByClassifiedNumber returns the entry', () => {
    registerClassifiedGame(fixtureSpec());
    expect(getClassifiedGameByClassifiedNumber(1)?.gameId).toBe('russian-draughts');
  });

  it('getClassifiedGames sorts by classifiedNumber', () => {
    registerClassifiedGame(fixtureSpec());
    registerClassifiedGame(
      fixtureSpec({
        gameId: asClassifiedGameId('brazilian-draughts'),
        classifiedNumber: 2,
        displayName: 'Brazilian Draughts',
        codeUnlockKey: 'CLASSIFIED02',
      }),
    );
    const games = getClassifiedGames();
    expect(games.map((g) => g.classifiedNumber)).toEqual([1, 2]);
  });

  it('getClassifiedGamesByWave filters by wave', () => {
    registerClassifiedGame(fixtureSpec());
    expect(getClassifiedGamesByWave(1)).toHaveLength(1);
    expect(getClassifiedGamesByWave(2)).toHaveLength(0);
  });

  it('getClassifiedGamesByTier filters by tier', () => {
    registerClassifiedGame(fixtureSpec());
    expect(getClassifiedGamesByTier(1)).toHaveLength(1);
    expect(getClassifiedGamesByTier(7)).toHaveLength(0);
  });

  it('getClassifiedGamesByFamily filters by family', () => {
    registerClassifiedGame(fixtureSpec());
    expect(getClassifiedGamesByFamily('Draughts')).toHaveLength(1);
    expect(getClassifiedGamesByFamily('Chess')).toHaveLength(0);
  });

  it('listClassifiedGameIds returns every registered id', () => {
    registerClassifiedGame(fixtureSpec());
    expect(listClassifiedGameIds()).toContain('russian-draughts');
  });

  it('isClassifiedRegistered reports registration state', () => {
    expect(isClassifiedRegistered(asClassifiedGameId('russian-draughts'))).toBe(false);
    registerClassifiedGame(fixtureSpec());
    expect(isClassifiedRegistered(asClassifiedGameId('russian-draughts'))).toBe(true);
  });
});

describe('registerClassifiedGame — idempotency + conflict policy', () => {
  it('throws duplicate-gameId on re-registration without { replace: true }', () => {
    registerClassifiedGame(fixtureSpec());
    let err: unknown;
    try {
      registerClassifiedGame(fixtureSpec());
    } catch (e) {
      err = e;
    }
    expect((err as ClassifiedRegistrationError).kind).toBe('duplicate-gameId');
  });

  it('accepts re-registration with { replace: true }', () => {
    registerClassifiedGame(fixtureSpec());
    const second = registerClassifiedGame(
      fixtureSpec({ displayName: 'Russian Draughts' }),
      { replace: true },
    );
    expect(second.gameId).toBe('russian-draughts');
  });

  it('throws duplicate-classifiedNumber when two different games claim the same slot', () => {
    registerClassifiedGame(fixtureSpec());
    let err: unknown;
    try {
      // Matching displayName avoids placeholder-mismatch and isolates the
      // duplicate-classifiedNumber assertion.
      registerClassifiedGame(
        fixtureSpec({
          gameId: asClassifiedGameId('brazilian-draughts'),
          displayName: 'Russian Draughts',
          codeUnlockKey: 'CLASSIFIED02',
        }),
      );
    } catch (e) {
      err = e;
    }
    expect((err as ClassifiedRegistrationError).kind).toBe('duplicate-classifiedNumber');
  });

  it('throws duplicate-codeUnlockKey when the same unlock key is reused', () => {
    registerClassifiedGame(fixtureSpec());
    let err: unknown;
    try {
      registerClassifiedGame(
        fixtureSpec({
          gameId: asClassifiedGameId('brazilian-draughts'),
          classifiedNumber: 2,
          displayName: 'Brazilian Draughts',
        }),
      );
    } catch (e) {
      err = e;
    }
    expect((err as ClassifiedRegistrationError).kind).toBe('duplicate-codeUnlockKey');
  });
});

describe('_clearClassifiedRegistry — test isolation', () => {
  it('empties the registry and the Cogitate adapter registry', () => {
    registerClassifiedGame(fixtureSpec());
    _clearClassifiedRegistry();
    expect(getClassifiedGames()).toHaveLength(0);
    expect(hasAdapter('classified-russian-draughts')).toBe(false);
  });
});
