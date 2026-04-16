/**
 * Classified registry — `registerClassifiedGame` + the read surface (Task 27.4).
 *
 * The registration call-site for every Tier 1–7 Classified game. Closes
 * Task 27.1 handoff deltas X-04 (worker rule-set registry now extensible),
 * X-08 (placeholder vs. real registration merge), T1-03, T3-05, T7-08.
 *
 * The pipeline is atomic — if any downstream registration (GameModeRegistry,
 * Cogitate adapter, worker rule-set) throws, the ClassifiedRegistry entry is
 * rolled back so partial state never leaks.
 */

import {
  type CogitateGameAdapter,
  registerAdapter,
  _clearAdapterRegistry,
} from '../../cogitate/CogitateGameAdapter';
import {
  ClassifiedRegistrationError,
  type ClassifiedRegistrationSpec,
  type RegistrationOptions,
  validateSpec,
} from './registrationSpec';
import type {
  ClassifiedFamily,
  ClassifiedGameId,
} from './ClassifiedRuleSet';
import { createDefaultClassifiedAdapter } from './defaultAdapter';
import {
  _registerClassifiedMode,
  _unregisterClassifiedMode,
} from '../../persistence/gameModeRegistry';
import {
  _unregisterSerializer,
  registerSerializerForSpec,
} from '../../persistence/serializers';

// ---------------------------------------------------------------------------
// Entry shape
// ---------------------------------------------------------------------------

export interface ClassifiedRegistryEntry extends ClassifiedRegistrationSpec {
  /** Canonical modeId used by GameModeRegistry + Cogitate adapter registry. */
  readonly modeId: string;
  /** Date.now() at registration time — useful for ordering in tests. */
  readonly registeredAt: number;
}

// ---------------------------------------------------------------------------
// In-memory registry
// ---------------------------------------------------------------------------

const registryByGameId = new Map<ClassifiedGameId, ClassifiedRegistryEntry>();
const registryByClassifiedNumber = new Map<number, ClassifiedRegistryEntry>();
const registryByCodeUnlockKey = new Map<string, ClassifiedRegistryEntry>();

// ---------------------------------------------------------------------------
// Public registration API
// ---------------------------------------------------------------------------

/**
 * Registers a Classified game. Side-effects: adds to GameModeRegistry,
 * generates + registers a default Cogitate adapter if one is not supplied,
 * and (for Phase-1-compatible rule sets) hooks the worker rule-set registry.
 *
 * Throws `ClassifiedRegistrationError` on any validation failure; partial
 * state is rolled back on downstream-registration failure.
 */
export function registerClassifiedGame(
  spec: ClassifiedRegistrationSpec,
  options: RegistrationOptions = {},
): ClassifiedRegistryEntry {
  validateSpec(spec, options);

  // Uniqueness — gameId
  const existingByGameId = registryByGameId.get(spec.gameId);
  if (existingByGameId && options.replace !== true) {
    throw new ClassifiedRegistrationError({
      kind: 'duplicate-gameId',
      gameId: spec.gameId,
      message: `gameId "${spec.gameId}" is already registered; pass { replace: true } to overwrite`,
    });
  }

  // Uniqueness — classifiedNumber (no replace escape — slot is immutable)
  const existingByNumber = registryByClassifiedNumber.get(spec.classifiedNumber);
  if (existingByNumber && existingByNumber.gameId !== spec.gameId) {
    throw new ClassifiedRegistrationError({
      kind: 'duplicate-classifiedNumber',
      classifiedNumber: spec.classifiedNumber,
      message:
        `classifiedNumber ${String(spec.classifiedNumber)} is already claimed by ` +
        `"${existingByNumber.gameId}"`,
    });
  }

  // Uniqueness — codeUnlockKey (no replace escape)
  const existingByCode = registryByCodeUnlockKey.get(spec.codeUnlockKey);
  if (existingByCode && existingByCode.gameId !== spec.gameId) {
    throw new ClassifiedRegistrationError({
      kind: 'duplicate-codeUnlockKey',
      message:
        `codeUnlockKey "${spec.codeUnlockKey}" is already claimed by "${existingByCode.gameId}"`,
    });
  }

  // If replacing, roll the prior entry out first
  if (existingByGameId) {
    _removeEntry(existingByGameId);
  }

  const entry: ClassifiedRegistryEntry = Object.freeze({
    ...spec,
    modeId: `classified-${spec.gameId}`,
    registeredAt: Date.now(),
  });

  // Insert into local maps first so the adapter generator can reference it.
  registryByGameId.set(entry.gameId, entry);
  registryByClassifiedNumber.set(entry.classifiedNumber, entry);
  registryByCodeUnlockKey.set(entry.codeUnlockKey, entry);

  // Downstream registrations — atomic: roll back on failure.
  try {
    _registerClassifiedMode(entry);

    const adapter: CogitateGameAdapter = spec.adapter ?? createDefaultClassifiedAdapter(entry);
    registerAdapter(adapter);

    // Task 27.6 — auto-register the per-game serializer. Runs after the
    // other downstream registrations so a serializer failure rolls back
    // all of them; Task 36.4 assumes registry state is coherent.
    registerSerializerForSpec(entry.gameId, spec.ruleSet.serializer);
  } catch (err) {
    // Roll back in-memory state.
    registryByGameId.delete(entry.gameId);
    registryByClassifiedNumber.delete(entry.classifiedNumber);
    registryByCodeUnlockKey.delete(entry.codeUnlockKey);
    _unregisterClassifiedMode(entry.modeId);
    _unregisterSerializer(entry.gameId);
    throw new ClassifiedRegistrationError({
      kind: 'downstream-registration-failed',
      gameId: entry.gameId,
      cause: err,
      message: `downstream registration failed for "${entry.gameId}": ${String(
        err instanceof Error ? err.message : err,
      )}`,
    });
  }

  return entry;
}

// ---------------------------------------------------------------------------
// Read surface
// ---------------------------------------------------------------------------

export function getClassifiedGame(
  gameId: ClassifiedGameId,
): ClassifiedRegistryEntry | null {
  return registryByGameId.get(gameId) ?? null;
}

export function getClassifiedGameByClassifiedNumber(
  classifiedNumber: number,
): ClassifiedRegistryEntry | null {
  return registryByClassifiedNumber.get(classifiedNumber) ?? null;
}

export function getClassifiedGames(): readonly ClassifiedRegistryEntry[] {
  return [...registryByGameId.values()].sort(
    (a, b) => a.classifiedNumber - b.classifiedNumber,
  );
}

export function getClassifiedGamesByWave(
  wave: number,
): readonly ClassifiedRegistryEntry[] {
  return getClassifiedGames().filter((e) => e.wave === wave);
}

export function getClassifiedGamesByTier(
  tier: number,
): readonly ClassifiedRegistryEntry[] {
  return getClassifiedGames().filter((e) => e.tier === tier);
}

export function getClassifiedGamesByFamily(
  family: ClassifiedFamily,
): readonly ClassifiedRegistryEntry[] {
  return getClassifiedGames().filter((e) => e.family === family);
}

export function isClassifiedRegistered(gameId: ClassifiedGameId): boolean {
  return registryByGameId.has(gameId);
}

export function listClassifiedGameIds(): readonly ClassifiedGameId[] {
  return [...registryByGameId.keys()];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _removeEntry(entry: ClassifiedRegistryEntry): void {
  registryByGameId.delete(entry.gameId);
  registryByClassifiedNumber.delete(entry.classifiedNumber);
  registryByCodeUnlockKey.delete(entry.codeUnlockKey);
  _unregisterClassifiedMode(entry.modeId);
  _unregisterSerializer(entry.gameId);
}

/**
 * Test-only utility: clears every Classified registration plus the Cogitate
 * adapter registry so each test starts from a clean slate. Named with the
 * leading underscore per the Phase 3 convention.
 */
export function _clearClassifiedRegistry(): void {
  for (const entry of [...registryByGameId.values()]) {
    _unregisterClassifiedMode(entry.modeId);
    _unregisterSerializer(entry.gameId);
  }
  registryByGameId.clear();
  registryByClassifiedNumber.clear();
  registryByCodeUnlockKey.clear();
  _clearAdapterRegistry();
}
