/**
 * Tier 1 cross-game registry invariants (Task 28.3 §7.3..§7.6).
 *
 * Asserts global uniqueness, reachability, identity-equality, unlockCodes
 * alignment, and narrative coverage across the ten Tier 1 registrations.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  _clearClassifiedRegistry,
  getClassifiedGame,
  getClassifiedGameByClassifiedNumber,
  getClassifiedGamesByFamily,
  getClassifiedGamesByTier,
  getClassifiedGamesByWave,
  listClassifiedGameIds,
} from '../../registry';
import { _clearTierLoaderCache, loadClassifiedTier } from '../../tierLoader';
import { hasAdapter } from '../../../../cogitate/CogitateGameAdapter';
import { getMode } from '../../../../persistence/gameModeRegistry';
import { CLASSIFIED_PLACEHOLDER_DATA } from '../../../../persistence/classifiedPlaceholderData';
import { TIER_1_GAME_IDS } from '../ids';
import { TIER_1_CONNECTIONS } from '../narratives';
import { russianDraughtsRuleSet } from '../russian';
import { brazilianDraughtsRuleSet } from '../brazilian';
import { italianDraughtsRuleSet } from '../italian';
import { internationalCheckersRuleSet } from '../international';
import { fryskRuleSet } from '../frysk';
import { frisianDraughtsRuleSet } from '../frisian';
import { malaysianCheckersRuleSet } from '../malaysian';
import { canadianDraughtsRuleSet } from '../canadian';
import { armenianDraughtsRuleSet } from '../armenian';
import { turkishDraughtsRuleSet } from '../turkish';

const TIER_1_RULESETS_BY_GAME_ID: Readonly<
  Record<string, typeof russianDraughtsRuleSet>
> = {
  'russian-draughts': russianDraughtsRuleSet,
  'brazilian-draughts': brazilianDraughtsRuleSet,
  'italian-draughts': italianDraughtsRuleSet,
  'international-checkers': internationalCheckersRuleSet,
  frysk: fryskRuleSet,
  'frisian-draughts': frisianDraughtsRuleSet,
  'malaysian-checkers': malaysianCheckersRuleSet,
  'canadian-draughts': canadianDraughtsRuleSet,
  'armenian-draughts': armenianDraughtsRuleSet,
  'turkish-draughts': turkishDraughtsRuleSet,
};

beforeEach(async () => {
  _clearClassifiedRegistry();
  _clearTierLoaderCache();
  await loadClassifiedTier(1);
});

describe('Tier 1 cross-game registry invariants', () => {
  it('all ten gameIds are unique', () => {
    const ids = TIER_1_GAME_IDS.map(String);
    expect(new Set(ids).size).toBe(10);
  });

  it('all ten classifiedNumbers are 1..10 with no collisions', () => {
    const entries = getClassifiedGamesByTier(1);
    const numbers = entries.map((e) => e.classifiedNumber).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('all ten codeUnlockKeys are CLASSIFIED01..CLASSIFIED10 with no collisions', () => {
    const entries = getClassifiedGamesByTier(1);
    const codes = entries.map((e) => e.codeUnlockKey).sort();
    expect(new Set(codes).size).toBe(10);
    expect(codes).toEqual([
      'CLASSIFIED01',
      'CLASSIFIED02',
      'CLASSIFIED03',
      'CLASSIFIED04',
      'CLASSIFIED05',
      'CLASSIFIED06',
      'CLASSIFIED07',
      'CLASSIFIED08',
      'CLASSIFIED09',
      'CLASSIFIED10',
    ]);
  });

  it('every entry is reachable via getClassifiedGame and getClassifiedGameByClassifiedNumber', () => {
    for (const entry of getClassifiedGamesByTier(1)) {
      expect(getClassifiedGame(entry.gameId)).toBe(entry);
      expect(getClassifiedGameByClassifiedNumber(entry.classifiedNumber)).toBe(entry);
    }
  });

  it('every modeId follows the classified-${gameId} convention and is in GameModeRegistry', () => {
    for (const entry of getClassifiedGamesByTier(1)) {
      expect(entry.modeId).toBe(`classified-${entry.gameId}`);
      expect(getMode(entry.modeId)).toBeDefined();
    }
  });

  it('every gameId appears in listClassifiedGameIds', () => {
    const registered = new Set(listClassifiedGameIds().map(String));
    for (const id of TIER_1_GAME_IDS) {
      expect(registered.has(String(id))).toBe(true);
    }
  });

  it('every entry has a default Cogitate adapter registered', () => {
    for (const entry of getClassifiedGamesByTier(1)) {
      expect(hasAdapter(entry.modeId)).toBe(true);
    }
  });

  it('getClassifiedGamesByFamily(Draughts) returns all ten Tier 1 games', () => {
    const draughts = getClassifiedGamesByFamily('Draughts');
    const tier1Ids = new Set(TIER_1_GAME_IDS.map(String));
    const draughtsTier1 = draughts.filter((e) => tier1Ids.has(String(e.gameId)));
    expect(draughtsTier1).toHaveLength(10);
  });

  it('getClassifiedGamesByWave(1) includes at least all ten Tier 1 games', () => {
    const wave1 = getClassifiedGamesByWave(1);
    const tier1Ids = new Set(TIER_1_GAME_IDS.map(String));
    const wave1Tier1 = wave1.filter((e) => tier1Ids.has(String(e.gameId)));
    expect(wave1Tier1).toHaveLength(10);
  });

  it('every spec.boardGeometry shares identity with its ruleSet.boardGeometry', () => {
    for (const entry of getClassifiedGamesByTier(1)) {
      const ruleSet = TIER_1_RULESETS_BY_GAME_ID[entry.gameId];
      if (!ruleSet) throw new Error(`missing local rule set for ${String(entry.gameId)}`);
      expect(entry.boardGeometry).toBe(ruleSet.boardGeometry);
      expect(entry.pieceVocabularyId).toBe(ruleSet.pieceVocabulary.id);
    }
  });

  it('codeUnlockKey format matches the CLASSIFIED## padding convention', () => {
    for (const entry of getClassifiedGamesByTier(1)) {
      const expected = `CLASSIFIED${String(entry.classifiedNumber).padStart(2, '0')}`;
      expect(entry.codeUnlockKey).toBe(expected);
    }
  });

  it('every displayName matches CLASSIFIED_PLACEHOLDER_DATA byte-for-byte', () => {
    for (const entry of getClassifiedGamesByTier(1)) {
      const placeholder = CLASSIFIED_PLACEHOLDER_DATA.find(
        (p) => p.index === entry.classifiedNumber,
      );
      if (!placeholder) {
        throw new Error(`missing placeholder for ${String(entry.classifiedNumber)}`);
      }
      expect(entry.displayName).toBe(placeholder.displayName);
    }
  });

  it('TIER_1_CONNECTIONS covers all ten Tier 1 gameIds with non-trivial copy', () => {
    const expected = TIER_1_GAME_IDS.map(String).sort();
    expect(Object.keys(TIER_1_CONNECTIONS).sort()).toEqual(expected);
    for (const text of Object.values(TIER_1_CONNECTIONS)) {
      expect(text.length).toBeGreaterThanOrEqual(80);
    }
  });
});
