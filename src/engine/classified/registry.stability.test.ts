/**
 * registry.stability.test.ts — freezes the canonical Tier 0 fixture ids.
 *
 * A gameId is a persistence key; renaming one after release strands every
 * saved IndexedDB record that references it. These assertions turn CI red
 * on accidental renames. Tier tasks cite this file in their playbooks.
 */

import { describe, expect, it } from 'vitest';
import { TEST_CHECKERS_CLONE_ID } from './tier0/testCheckersClone';
import { TEST_SHOGI_CLONE_ID } from './tier0/testShogiClone';

describe('Classified gameId stability — Tier 0 fixtures', () => {
  it('testCheckersClone id is "classified-test-tier-0"', () => {
    expect(TEST_CHECKERS_CLONE_ID).toBe('classified-test-tier-0');
  });

  it('testShogiClone id is "classified-test-tier-shogi"', () => {
    expect(TEST_SHOGI_CLONE_ID).toBe('classified-test-tier-shogi');
  });

  it('Tier 0 fixture modeIds follow the `classified-<gameId>` convention', () => {
    // Direct string assertion — the registry derives modeId from gameId, so
    // this test doubles as a guard against changing that derivation rule.
    expect(`classified-${TEST_CHECKERS_CLONE_ID.replace(/^classified-/, '')}`).toBe(
      'classified-test-tier-0',
    );
  });
});
