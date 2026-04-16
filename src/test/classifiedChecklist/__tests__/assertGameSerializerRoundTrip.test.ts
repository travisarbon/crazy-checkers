/**
 * Task 27.7 — unit tests for assertGameSerializerRoundTrip.
 *
 * Positive path: Tier 0 checkers-clone fixture (Task 27.4) ships a minimal
 * serializer; its `startingPosition()` round-trips byte-identically through
 * the registry.
 *
 * Negative path: a game without a registered serializer throws a
 * ChecklistAssertionError with C-05/E on its failures list.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { _clearClassifiedRegistry } from '../../../engine/classified/registry';
import {
  _clearTierLoaderCache,
  loadClassifiedTier,
} from '../../../engine/classified/tierLoader';
import {
  TEST_CHECKERS_CLONE_ID,
  testCheckersCloneRuleSet,
} from '../../../engine/classified/tier0/testCheckersClone';
import { _clearAdapterRegistry } from '../../../cogitate/CogitateGameAdapter';
import { clearSerializers__TEST_ONLY } from '../../../persistence/serializers';
import { asClassifiedGameId } from '../../../engine/classified/ClassifiedRuleSet';

import { assertGameSerializerRoundTrip } from '../assertGameSerializerRoundTrip';
import { ChecklistAssertionError } from '../ChecklistAssertionError';

beforeEach(() => {
  _clearClassifiedRegistry();
  _clearAdapterRegistry();
  clearSerializers__TEST_ONLY();
  _clearTierLoaderCache();
});

describe('assertGameSerializerRoundTrip — positive path', () => {
  it('round-trips the Tier 0 checkers-clone starting position byte-identically', async () => {
    await loadClassifiedTier(0);
    const sample = testCheckersCloneRuleSet.startingPosition();
    expect(() => {
      assertGameSerializerRoundTrip(TEST_CHECKERS_CLONE_ID, sample);
    }).not.toThrow();
  });
});

describe('assertGameSerializerRoundTrip — negative path', () => {
  it('throws ChecklistAssertionError with C-05/E when no serializer is registered', () => {
    const ghost = asClassifiedGameId('classified-never-registered');
    let caught: ChecklistAssertionError | null = null;
    try {
      assertGameSerializerRoundTrip(ghost, { anything: true });
    } catch (err) {
      caught = err as ChecklistAssertionError;
    }
    expect(caught).toBeInstanceOf(ChecklistAssertionError);
    if (!caught) throw new Error('expected ChecklistAssertionError');
    expect(caught.failures[0]).toMatch(/^C-05\/E/);
    expect(caught.gameId).toBe(ghost);
  });
});
