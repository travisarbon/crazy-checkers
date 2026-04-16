/**
 * Task 27.7 — mechanical verifier for Classified §13 Review Checklist rows
 * C-01 (partial), C-02, C-05 (presence-only), C-06, C-09.
 *
 * Each clause is an independent assertion; the helper collects every failure
 * and throws a single structured ChecklistAssertionError naming every failing
 * clause so a tier task sees the complete remediation surface in one pass.
 *
 * Clause map:
 *   A → C-01: ClassifiedRuleSet registered and minimally valid.
 *   B → C-02: GameModeRegistry entry present with matching metadata.
 *   C → C-06: CogitateGameAdapter registered.
 *   D → C-09: Audio pack id declared on the registration spec.
 *   E → C-05: Serializer registered (presence only;
 *             round-trip verified by assertGameSerializerRoundTrip).
 */

import type { ClassifiedGameId } from '../../engine/classified/ClassifiedRuleSet';
import { getClassifiedGame } from '../../engine/classified/registry';
import { getMode } from '../../persistence/gameModeRegistry';
import { hasAdapter } from '../../cogitate/CogitateGameAdapter';
import { hasSerializer } from '../../persistence/serializers';
import { ChecklistAssertionError } from './ChecklistAssertionError';

export function assertGameRegistrationInvariants(gameId: ClassifiedGameId): void {
  const failures: string[] = [];

  // Clause A — C-01: ClassifiedRuleSet spec registered, minimally valid.
  const spec = getClassifiedGame(gameId);
  if (!spec) {
    failures.push(`C-01/A: no Classified registration for gameId "${gameId}"`);
  } else {
    if (typeof spec.ruleSet.startingPosition !== 'function') {
      failures.push('C-01/A: ruleSet.startingPosition is not a function');
    }
    if (typeof spec.ruleSet.getLegalMoves !== 'function') {
      failures.push('C-01/A: ruleSet.getLegalMoves is not a function');
    }
    if (typeof spec.ruleSet.applyMove !== 'function') {
      failures.push('C-01/A: ruleSet.applyMove is not a function');
    }
    if (typeof spec.ruleSet.checkGameOver !== 'function') {
      failures.push('C-01/A: ruleSet.checkGameOver is not a function');
    }
  }

  // Clause B — C-02: GameModeRegistry entry present, classifiedIndex matches.
  const modeId = spec ? spec.modeId : `classified-${gameId}`;
  const modeEntry = getMode(modeId);
  if (!modeEntry) {
    failures.push(
      `C-02/B: no GameModeRegistry entry for modeId "${modeId}" (expected classified-<gameId>)`,
    );
  } else if (spec && modeEntry.classifiedIndex !== spec.classifiedNumber) {
    failures.push(
      `C-02/B: classifiedIndex mismatch (registry=${String(modeEntry.classifiedIndex)}, spec=${String(
        spec.classifiedNumber,
      )})`,
    );
  }

  // Clause C — C-06: CogitateGameAdapter registered under modeId.
  if (!hasAdapter(modeId)) {
    failures.push(`C-06/C: no CogitateGameAdapter registered for modeId "${modeId}"`);
  }

  // Clause D — C-09: Audio pack id declared at registration time.
  //
  // The AudioPackRegistry runtime lookup is a Tier-task concern (not all packs
  // are loaded at seeding time), so this clause only asserts the spec declares
  // an audioPackId. Missing declarations fail fast regardless of tier loading.
  if (spec && (!spec.audioPackId || String(spec.audioPackId).length === 0)) {
    failures.push('C-09/D: spec.audioPackId is missing or empty');
  }

  // Clause E — C-05 (partial): serializer present. Round-trip in separate helper.
  if (!hasSerializer(gameId)) {
    failures.push(`C-05/E: no serializer registered for gameId "${gameId}"`);
  }

  if (failures.length > 0) {
    throw new ChecklistAssertionError({ gameId, failures });
  }
}
