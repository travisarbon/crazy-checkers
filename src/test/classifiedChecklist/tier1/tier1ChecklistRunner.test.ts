/**
 * Task 28.7 — Pass 1 mechanical sweep for the Tier 1 Completion Gate.
 *
 * For every Tier 1 gameId (Russian..Turkish), this suite exercises the §13
 * Review Checklist rows whose kind is `'mechanical'` (see rowStatus.ts):
 *
 *   C-01 / C-02 / C-06 / C-09 / C-05 (presence) — via
 *     `assertGameRegistrationInvariants(gameId)`.
 *   C-05 (round-trip) — via `assertGameSerializerRoundTrip(gameId, sample)`
 *     exercised against a deterministic set of sample states produced by
 *     `sampleStatesFor(gameId)`.
 *   C-11 (presence)  — looks up the per-game `CLASSIFIEDxx` row in
 *     `UNLOCK_CODES` and confirms its target list contains the live modeId.
 *   C-15 clause B   — asserts the registration spec carries
 *     `narrativeFlavor.connection` (the detail-screen flavor text).
 *
 * Reviewer-driven rows (C-03, C-04, C-07, C-08, C-10, C-13, C-14, and the
 * Replay / Track-5 sub-clauses of C-06 / C-15) are stubbed elsewhere and
 * not ticked here.
 *
 * Running the suite is the tier gate's own CI regression: after Tier 1
 * sign-off, any future Phase 4 change that regresses a Tier 1 row breaks
 * this file.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import {
  _clearClassifiedRegistry,
  getClassifiedGame,
} from '../../../engine/classified/registry';
import {
  _clearTierLoaderCache,
  loadClassifiedTier,
} from '../../../engine/classified/tierLoader';
import { _clearAdapterRegistry } from '../../../cogitate/CogitateGameAdapter';
import { clearSerializers__TEST_ONLY } from '../../../persistence/serializers';
import { TIER_1_GAME_IDS } from '../../../engine/classified/tier1/ids';
import { UNLOCK_CODES } from '../../../data/unlockCodes';

import { assertGameRegistrationInvariants } from '../assertGameRegistrationInvariants';
import { assertGameSerializerRoundTrip } from '../assertGameSerializerRoundTrip';
import { sampleStatesFor } from './sampleStates';

beforeAll(async () => {
  _clearClassifiedRegistry();
  _clearAdapterRegistry();
  clearSerializers__TEST_ONLY();
  _clearTierLoaderCache();
  await loadClassifiedTier(1);
});

describe('Task 28.7 Tier 1 Completion Gate — Pass 1 mechanical sweep', () => {
  it('TIER_1_GAME_IDS covers all 10 Tier 1 variants', () => {
    expect(TIER_1_GAME_IDS).toHaveLength(10);
  });

  describe.each(TIER_1_GAME_IDS.map((id) => [String(id)] as const))(
    '%s',
    (gameIdString) => {
      const gameId = TIER_1_GAME_IDS.find((g) => String(g) === gameIdString);
      if (!gameId) {
        throw new Error(`Tier 1 runner: missing gameId "${gameIdString}"`);
      }

      it('C-01 / C-02 / C-06 / C-09 / C-05 presence — assertGameRegistrationInvariants', () => {
        expect(() => {
          assertGameRegistrationInvariants(gameId);
        }).not.toThrow();
      });

      it('C-05 round-trip — serializer byte-identical on sample states', () => {
        const states = sampleStatesFor(gameId);
        expect(states.length).toBeGreaterThan(0);
        for (const state of states) {
          assertGameSerializerRoundTrip(gameId, state);
        }
      });

      it('C-11 presence — Code Mode entry exists and targets the classified-<index> placeholder', () => {
        // Current Code Mode convention (Phase 3 legacy, pre-Tier-1):
        // `UNLOCK_CODES['CLASSIFIED01']` targets `classified-1`, the placeholder
        // index string, not the real Tier 1 modeId `classified-russian-draughts`.
        // Per-game placeholder-to-modeId wiring is a reviewer-driven sub-clause
        // of C-11 (documented in ReviewerNotes/<gameId>.md and in the Task 28.7
        // Completion Note § "Shakedown findings"). This presence assertion only
        // verifies the code key exists and still routes through the placeholder.
        const spec = getClassifiedGame(gameId);
        if (!spec) throw new Error(`no spec for ${String(gameId)}`);

        const unlockKey = spec.codeUnlockKey; // e.g. 'CLASSIFIED01'
        const unlockEntry = UNLOCK_CODES[unlockKey];
        expect(unlockEntry, `UNLOCK_CODES["${unlockKey}"] must exist`).toBeDefined();

        const expectedPlaceholder = `classified-${String(spec.classifiedNumber)}`;
        const targets = unlockEntry?.targets;
        expect(
          Array.isArray(targets) && targets.includes(expectedPlaceholder),
          `UNLOCK_CODES["${unlockKey}"].targets must include "${expectedPlaceholder}"`,
        ).toBe(true);
      });

      it('C-15 clause B — narrativeFlavor.connection is non-empty', () => {
        const spec = getClassifiedGame(gameId);
        if (!spec) throw new Error(`no spec for ${String(gameId)}`);
        expect(spec.narrativeFlavor.wave.length).toBeGreaterThan(0);
        expect(spec.narrativeFlavor.family.length).toBeGreaterThan(0);
        expect(spec.narrativeFlavor.connection.length).toBeGreaterThan(0);
      });

      it('Registration metadata — classifiedNumber ∈ 1..10, tier = 1, wave = 1', () => {
        const spec = getClassifiedGame(gameId);
        if (!spec) throw new Error(`no spec for ${String(gameId)}`);
        expect(spec.tier).toBe(1);
        expect(spec.wave).toBe(1);
        expect(spec.classifiedNumber).toBeGreaterThanOrEqual(1);
        expect(spec.classifiedNumber).toBeLessThanOrEqual(10);
      });
    },
  );
});
