/**
 * PDN validator parseability harness (Task 28.6 §8).
 *
 * For each Tier 1 variant, generates legal moves from the starting position,
 * notates each move, and validates the notation token against the dialect's
 * grammar. Standards-conformant dialects must produce 100% valid tokens.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { PDN_DIALECT_MANIFEST } from './pdnValidatorParseability.fixtures';
import { TIER_1_DRAUGHTS_GAME_IDS, createDraughtsConfig } from '../../../engine/classified/draughts/DraughtsConfig';
import type { DraughtsGameId } from '../../../engine/classified/draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../../../engine/classified/draughts/ParameterizedDraughtsRules';
import { configToNotation } from '../../../engine/classified/draughts/configToNotation';
import type { ClassifiedGameState } from '../../../engine/classified/state';
import type { ClassifiedMove, NotationAdapter as Phase4Adapter } from '../../../engine/classified/ClassifiedRuleSet';
import { loadClassifiedTier } from '../../../engine/classified/tierLoader';
import { _clearClassifiedRegistry } from '../../../engine/classified/registry';
import { _clearTierLoaderCache } from '../../../engine/classified/tierLoader';

// ---------------------------------------------------------------------------
// PDN grammar validators
// ---------------------------------------------------------------------------

/** Standard numeric PDN token: digit(s) separator digit(s), with optional multi-captures. */
function isValidNumericPdn(token: string, min: number, max: number): boolean {
  // Simple move: "N-N"
  const simpleMatch = /^(\d+)-(\d+)$/.exec(token);
  if (simpleMatch) {
    const from = Number(simpleMatch[1]);
    const to = Number(simpleMatch[2]);
    return from >= min && from <= max && to >= min && to <= max;
  }

  // Capture: "N×N" or "NxN" with optional multi-captures
  const parts = token.split(/[×xX]/);
  if (parts.length >= 2) {
    return parts.every((part) => {
      // Strip decoration glyphs that dialect extensions add
      const cleaned = part.replace(/[⊥/−-]/g, '');
      const n = Number(cleaned);
      return Number.isFinite(n) && n >= min && n <= max;
    });
  }

  return false;
}

/** File-rank PDN token: "a1-b2" or "a1×b2" etc. */
function isValidFileRankPdn(token: string): boolean {
  // Simple: "XN-XN"
  const simpleMatch = /^([a-h]\d)-([a-h]\d)$/.exec(token);
  if (simpleMatch) return true;

  // Capture: split on × (possibly decorated)
  const parts = token.split(/[×xX]/);
  if (parts.length >= 2) {
    return parts.every((part) => {
      const cleaned = part.replace(/[⊥/−-]/g, '').trim();
      return /^[a-h]\d$/.test(cleaned);
    });
  }

  return false;
}

function isValidPdnToken(
  token: string,
  _dialectKey: string,
  min: number,
  max: number,
  scheme: 'numeric-diagonal' | 'file-rank',
): boolean {
  if (scheme === 'file-rank') return isValidFileRankPdn(token);
  return isValidNumericPdn(token, min, max);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PDN Validator Parseability', () => {
  beforeAll(async () => {
    _clearClassifiedRegistry();
    _clearTierLoaderCache();
    await loadClassifiedTier(1);
  });

  it('manifest covers all 10 Tier 1 variants', () => {
    const coveredGameIds = new Set(
      PDN_DIALECT_MANIFEST.flatMap((m) => m.gameIds),
    );
    for (const gameId of TIER_1_DRAUGHTS_GAME_IDS) {
      expect(coveredGameIds.has(gameId)).toBe(true);
    }
  });

  it.each([...TIER_1_DRAUGHTS_GAME_IDS])(
    '%s: all legal moves from starting position produce valid notation tokens',
    (gameId: DraughtsGameId) => {
      const manifest = PDN_DIALECT_MANIFEST.find((m) =>
        m.gameIds.includes(gameId),
      );
      expect(manifest).toBeDefined();
      if (!manifest) return;

      const config = createDraughtsConfig(gameId);
      const ruleSet = createDraughtsRuleSet(config);
      const notation = configToNotation(config) as Phase4Adapter<
        ClassifiedGameState,
        ClassifiedMove
      >;

      const state = ruleSet.startingPosition();
      const moves = ruleSet.getLegalMoves(state);
      expect(moves.length).toBeGreaterThan(0);

      let validCount = 0;
      for (const move of moves) {
        const token = notation.notate(state, move as unknown as ClassifiedMove);
        const isValid = isValidPdnToken(
          token,
          manifest.dialectKey,
          manifest.numericRange[0],
          manifest.numericRange[1],
          manifest.coordinateScheme,
        );

        if (isValid) validCount++;
      }

      // 100% of tokens must be valid per the dialect's grammar.
      expect(validCount).toBe(moves.length);
    },
  );

  it.each(
    PDN_DIALECT_MANIFEST.filter((m) => m.standardConformant).map((m) => m.dialectKey),
  )(
    'dialect %s: 100%% standards-conformant',
    (dialectKey) => {
      const manifest = PDN_DIALECT_MANIFEST.find(
        (m) => m.dialectKey === dialectKey,
      );
      expect(manifest).toBeDefined();
      if (!manifest) return;

      expect(manifest.nonStandardSeparators).toHaveLength(0);
      expect(manifest.standardConformant).toBe(true);
    },
  );

  it.each(
    PDN_DIALECT_MANIFEST.filter((m) => !m.standardConformant).map((m) => m.dialectKey),
  )(
    'dialect %s: declares non-standard separators',
    (dialectKey) => {
      const manifest = PDN_DIALECT_MANIFEST.find(
        (m) => m.dialectKey === dialectKey,
      );
      expect(manifest).toBeDefined();
      if (!manifest) return;

      // Non-standard dialects should either have declared separators or
      // use file-rank notation (which is non-standard by definition).
      expect(
        manifest.nonStandardSeparators.length > 0 ||
          manifest.coordinateScheme === 'file-rank',
      ).toBe(true);
    },
  );
});
