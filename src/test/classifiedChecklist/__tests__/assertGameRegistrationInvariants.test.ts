/**
 * Task 27.7 — unit tests for assertGameRegistrationInvariants.
 *
 * Uses the Tier 0 fixture (Task 27.4) as the positive path: after
 * loadClassifiedTier(0), the checkers-clone registration passes every
 * clause (A–E). Negative paths deliberately strip individual downstream
 * registrations and assert the correct clause letter surfaces.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  _clearClassifiedRegistry,
} from '../../../engine/classified/registry';
import {
  _clearTierLoaderCache,
  loadClassifiedTier,
} from '../../../engine/classified/tierLoader';
import { TEST_CHECKERS_CLONE_ID } from '../../../engine/classified/tier0/testCheckersClone';
import { _clearAdapterRegistry } from '../../../cogitate/CogitateGameAdapter';
import { clearSerializers__TEST_ONLY, _unregisterSerializer } from '../../../persistence/serializers';
import { asClassifiedGameId } from '../../../engine/classified/ClassifiedRuleSet';

import { assertGameRegistrationInvariants } from '../assertGameRegistrationInvariants';
import { ChecklistAssertionError } from '../ChecklistAssertionError';

beforeEach(() => {
  _clearClassifiedRegistry();
  _clearAdapterRegistry();
  clearSerializers__TEST_ONLY();
  _clearTierLoaderCache();
});

function requireError(
  caught: ChecklistAssertionError | null,
): ChecklistAssertionError {
  if (!caught) throw new Error('expected ChecklistAssertionError but none was thrown');
  return caught;
}

describe('assertGameRegistrationInvariants — positive path', () => {
  it('passes for the Tier 0 fixture after loadClassifiedTier(0)', async () => {
    await loadClassifiedTier(0);
    expect(() => {
      assertGameRegistrationInvariants(TEST_CHECKERS_CLONE_ID);
    }).not.toThrow();
  });
});

describe('assertGameRegistrationInvariants — negative paths', () => {
  it('clause A: reports missing registration when gameId is unknown', () => {
    const ghost = asClassifiedGameId('classified-never-registered');
    let caught: ChecklistAssertionError | null = null;
    try {
      assertGameRegistrationInvariants(ghost);
    } catch (err) {
      caught = err as ChecklistAssertionError;
    }
    expect(caught).toBeInstanceOf(ChecklistAssertionError);
    const err = requireError(caught);
    expect(err.failures.some((f) => f.startsWith('C-01/A'))).toBe(true);
    // When clause A fails (no spec), clause B also fires because modeId
    // cannot be resolved; this is intentional — reviewers see the full
    // remediation surface in one pass.
    expect(err.failures.some((f) => f.startsWith('C-02/B'))).toBe(true);
  });

  it('clause C: reports missing Cogitate adapter after adapter registry is cleared', async () => {
    await loadClassifiedTier(0);
    _clearAdapterRegistry();
    let caught: ChecklistAssertionError | null = null;
    try {
      assertGameRegistrationInvariants(TEST_CHECKERS_CLONE_ID);
    } catch (err) {
      caught = err as ChecklistAssertionError;
    }
    expect(caught).toBeInstanceOf(ChecklistAssertionError);
    expect(requireError(caught).failures.some((f) => f.startsWith('C-06/C'))).toBe(true);
  });

  it('clause E: reports missing serializer when serializer registry is stripped', async () => {
    await loadClassifiedTier(0);
    _unregisterSerializer(TEST_CHECKERS_CLONE_ID);
    let caught: ChecklistAssertionError | null = null;
    try {
      assertGameRegistrationInvariants(TEST_CHECKERS_CLONE_ID);
    } catch (err) {
      caught = err as ChecklistAssertionError;
    }
    expect(caught).toBeInstanceOf(ChecklistAssertionError);
    expect(requireError(caught).failures.some((f) => f.startsWith('C-05/E'))).toBe(true);
  });

  it('collects multiple clauses in a single error', async () => {
    await loadClassifiedTier(0);
    _clearAdapterRegistry();
    _unregisterSerializer(TEST_CHECKERS_CLONE_ID);
    let caught: ChecklistAssertionError | null = null;
    try {
      assertGameRegistrationInvariants(TEST_CHECKERS_CLONE_ID);
    } catch (err) {
      caught = err as ChecklistAssertionError;
    }
    expect(caught).toBeInstanceOf(ChecklistAssertionError);
    const err = requireError(caught);
    expect(err.failures.some((f) => f.startsWith('C-06/C'))).toBe(true);
    expect(err.failures.some((f) => f.startsWith('C-05/E'))).toBe(true);
    // Distinct clauses => at least 2 failure strings.
    expect(err.failures.length).toBeGreaterThanOrEqual(2);
  });

  it('ChecklistAssertionError carries gameId and readonly failures', () => {
    const ghost = asClassifiedGameId('classified-never-registered');
    let caught: ChecklistAssertionError | null = null;
    try {
      assertGameRegistrationInvariants(ghost);
    } catch (err) {
      caught = err as ChecklistAssertionError;
    }
    const err = requireError(caught);
    expect(err.gameId).toBe(ghost);
    expect(Object.isFrozen(err.failures)).toBe(true);
    expect(err.name).toBe('ChecklistAssertionError');
  });
});
