/**
 * Per-game registration coverage for the ten Tier 1 Classified games (Task 28.3).
 *
 * Replaces the plan §7.1 ten-test-files layout with a single parameterised
 * suite — every assertion in the original template runs once per game with
 * the gameId visible in the test name, so error locality is preserved while
 * boilerplate disappears.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  _clearClassifiedRegistry,
  type ClassifiedRegistryEntry,
} from '../../registry';
import { _clearTierLoaderCache } from '../../tierLoader';
import { ClassifiedRegistrationError } from '../../registrationSpec';
import { CLASSIFIED_PLACEHOLDER_DATA } from '../../../../persistence/classifiedPlaceholderData';
import { UNLOCK_CODES } from '../../../../data/unlockCodes';
import {
  RUSSIAN_DRAUGHTS_ID,
  BRAZILIAN_DRAUGHTS_ID,
  ITALIAN_DRAUGHTS_ID,
  INTERNATIONAL_CHECKERS_ID,
  FRYSK_ID,
  FRISIAN_DRAUGHTS_ID,
  MALAYSIAN_CHECKERS_ID,
  CANADIAN_DRAUGHTS_ID,
  ARMENIAN_DRAUGHTS_ID,
  TURKISH_DRAUGHTS_ID,
} from '../ids';
import { registerRussianDraughts, russianDraughtsRuleSet } from '../russian';
import {
  registerBrazilianDraughts,
  brazilianDraughtsRuleSet,
} from '../brazilian';
import { registerItalianDraughts, italianDraughtsRuleSet } from '../italian';
import {
  registerInternationalCheckers,
  internationalCheckersRuleSet,
} from '../international';
import { registerFrysk, fryskRuleSet } from '../frysk';
import { registerFrisianDraughts, frisianDraughtsRuleSet } from '../frisian';
import {
  registerMalaysianCheckers,
  malaysianCheckersRuleSet,
} from '../malaysian';
import { registerCanadianDraughts, canadianDraughtsRuleSet } from '../canadian';
import { registerArmenianDraughts, armenianDraughtsRuleSet } from '../armenian';
import { registerTurkishDraughts, turkishDraughtsRuleSet } from '../turkish';

interface PerGameCase {
  readonly gameId: string;
  readonly classifiedNumber: number;
  readonly displayName: string;
  readonly codeUnlockKey: string;
  readonly modeId: string;
  readonly register: (opts?: { replace?: boolean }) => ClassifiedRegistryEntry;
  readonly ruleSet: typeof russianDraughtsRuleSet;
}

const TIER_1_CASES: readonly PerGameCase[] = [
  {
    gameId: RUSSIAN_DRAUGHTS_ID,
    classifiedNumber: 1,
    displayName: 'Russian Draughts',
    codeUnlockKey: 'CLASSIFIED01',
    modeId: 'classified-russian-draughts',
    register: registerRussianDraughts,
    ruleSet: russianDraughtsRuleSet,
  },
  {
    gameId: BRAZILIAN_DRAUGHTS_ID,
    classifiedNumber: 2,
    displayName: 'Brazilian Draughts',
    codeUnlockKey: 'CLASSIFIED02',
    modeId: 'classified-brazilian-draughts',
    register: registerBrazilianDraughts,
    ruleSet: brazilianDraughtsRuleSet,
  },
  {
    gameId: ITALIAN_DRAUGHTS_ID,
    classifiedNumber: 3,
    displayName: 'Italian Draughts',
    codeUnlockKey: 'CLASSIFIED03',
    modeId: 'classified-italian-draughts',
    register: registerItalianDraughts,
    ruleSet: italianDraughtsRuleSet,
  },
  {
    gameId: INTERNATIONAL_CHECKERS_ID,
    classifiedNumber: 4,
    displayName: 'International Checkers',
    codeUnlockKey: 'CLASSIFIED04',
    modeId: 'classified-international-checkers',
    register: registerInternationalCheckers,
    ruleSet: internationalCheckersRuleSet,
  },
  {
    gameId: FRYSK_ID,
    classifiedNumber: 5,
    displayName: 'Frysk!',
    codeUnlockKey: 'CLASSIFIED05',
    modeId: 'classified-frysk',
    register: registerFrysk,
    ruleSet: fryskRuleSet,
  },
  {
    gameId: FRISIAN_DRAUGHTS_ID,
    classifiedNumber: 6,
    displayName: 'Frisian Draughts',
    codeUnlockKey: 'CLASSIFIED06',
    modeId: 'classified-frisian-draughts',
    register: registerFrisianDraughts,
    ruleSet: frisianDraughtsRuleSet,
  },
  {
    gameId: MALAYSIAN_CHECKERS_ID,
    classifiedNumber: 7,
    displayName: 'Malaysian Checkers',
    codeUnlockKey: 'CLASSIFIED07',
    modeId: 'classified-malaysian-checkers',
    register: registerMalaysianCheckers,
    ruleSet: malaysianCheckersRuleSet,
  },
  {
    gameId: CANADIAN_DRAUGHTS_ID,
    classifiedNumber: 8,
    displayName: 'Canadian Draughts',
    codeUnlockKey: 'CLASSIFIED08',
    modeId: 'classified-canadian-draughts',
    register: registerCanadianDraughts,
    ruleSet: canadianDraughtsRuleSet,
  },
  {
    gameId: ARMENIAN_DRAUGHTS_ID,
    classifiedNumber: 9,
    displayName: 'Armenian Draughts',
    codeUnlockKey: 'CLASSIFIED09',
    modeId: 'classified-armenian-draughts',
    register: registerArmenianDraughts,
    ruleSet: armenianDraughtsRuleSet,
  },
  {
    gameId: TURKISH_DRAUGHTS_ID,
    classifiedNumber: 10,
    displayName: 'Turkish Draughts',
    codeUnlockKey: 'CLASSIFIED10',
    modeId: 'classified-turkish-draughts',
    register: registerTurkishDraughts,
    ruleSet: turkishDraughtsRuleSet,
  },
];

beforeEach(() => {
  _clearClassifiedRegistry();
  _clearTierLoaderCache();
});

describe('Tier 1 per-game registration', () => {
  it.each(TIER_1_CASES)(
    '$gameId: registers without error with clean registry',
    ({ gameId, classifiedNumber, modeId, register, ruleSet }) => {
      const entry = register();
      expect(entry.gameId).toBe(gameId);
      expect(entry.classifiedNumber).toBe(classifiedNumber);
      expect(entry.modeId).toBe(modeId);
      expect(entry.ruleSet).toBe(ruleSet);
    },
  );

  it.each(TIER_1_CASES)(
    '$gameId: idempotent with { replace: true }',
    ({ register }) => {
      register({ replace: true });
      expect(() => register({ replace: true })).not.toThrow();
    },
  );

  it.each(TIER_1_CASES)(
    '$gameId: refuses re-registration without replace flag',
    ({ register }) => {
      register();
      expect(() => register()).toThrow(ClassifiedRegistrationError);
    },
  );

  it.each(TIER_1_CASES)(
    '$gameId: placeholder displayName agreement',
    ({ classifiedNumber, displayName }) => {
      const placeholder = CLASSIFIED_PLACEHOLDER_DATA.find(
        (p) => p.index === classifiedNumber,
      );
      if (!placeholder) throw new Error(`missing placeholder for ${String(classifiedNumber)}`);
      expect(placeholder.displayName).toBe(displayName);
    },
  );

  it.each(TIER_1_CASES)(
    '$gameId: codeUnlockKey is in UNLOCK_CODES targeting the matching slot',
    ({ classifiedNumber, codeUnlockKey }) => {
      const entry = UNLOCK_CODES[codeUnlockKey];
      if (!entry) throw new Error(`missing UNLOCK_CODES entry for ${codeUnlockKey}`);
      expect(entry.targets).toContain(`classified-${String(classifiedNumber)}`);
    },
  );

  it.each(TIER_1_CASES)(
    '$gameId: narrativeFlavor is well-formed',
    ({ register }) => {
      const entry = register();
      expect(entry.narrativeFlavor.wave).toMatch(/Wave 1/);
      expect(entry.narrativeFlavor.family).toBe('Draughts');
      expect(entry.narrativeFlavor.connection.length).toBeGreaterThanOrEqual(80);
    },
  );
});
