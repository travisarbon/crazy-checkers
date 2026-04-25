/**
 * registrationSpec — the spec shape, validator, and error taxonomy for
 * `registerClassifiedGame` (Task 27.4).
 *
 * Factored out of registry.ts so validation can be unit-tested in isolation
 * without spinning up the rest of the registration pipeline. Error kinds
 * enumerate every failure case listed in the Task 27.4 plan §4.13.
 */

import type { BoardGeometry } from '../boardGeometry';
import type { CogitateGameAdapter } from '../../cogitate/CogitateGameAdapter';
import type {
  AudioPackId,
  PieceVocabularyId,
} from './pieceVocabulary';
import type {
  ClassifiedFamily,
  ClassifiedGameId,
  ClassifiedRuleSet,
} from './ClassifiedRuleSet';
import { CLASSIFIED_PLACEHOLDER_DATA } from '../../persistence/classifiedPlaceholderData';
import { UNLOCK_CODES } from '../../data/unlockCodes';

// ---------------------------------------------------------------------------
// Spec shape
// ---------------------------------------------------------------------------

export interface ClassifiedRegistrationSpec {
  readonly gameId: ClassifiedGameId;
  /** 1..64 for production games; 0 or -1 reserved for Tier 0 test fixtures. */
  readonly classifiedNumber: number;
  readonly wave: number;
  readonly tier: number;
  readonly family: ClassifiedFamily;
  readonly displayName: string;
  readonly ruleSet: ClassifiedRuleSet;
  readonly adapter?: CogitateGameAdapter;
  readonly boardGeometry: BoardGeometry;
  readonly boardRenderer?: string;
  readonly pieceVocabularyId: PieceVocabularyId;
  readonly audioPackId: AudioPackId;
  readonly codeUnlockKey: string;
  readonly narrativeFlavor: {
    readonly wave: string;
    readonly family: string;
    readonly connection: string;
  };
  /**
   * Short one-line rule summary (≤120 chars) rendered on the MVP Classified
   * detail screen (Task 27.8). Task 35.2 replaces this with a full rule
   * panel. Optional on the spec to preserve backward compatibility with
   * existing Tier 1 registrations; `ClassifiedDetailScreen` falls back to a
   * generic placeholder when absent.
   */
  readonly mvpRuleSummary?: string;
}

export interface RegistrationOptions {
  readonly replace?: boolean;
  /** Allow `classifiedNumber` values of `0` or `-1` for test fixtures. */
  readonly allowTierZero?: boolean;
  /** Allow tiers 8..11 for future expansion. */
  readonly allowExpansion?: boolean;
}

// ---------------------------------------------------------------------------
// Error taxonomy
// ---------------------------------------------------------------------------

export type ClassifiedRegistrationErrorKind =
  | 'invalid-gameId'
  | 'duplicate-gameId'
  | 'duplicate-classifiedNumber'
  | 'duplicate-codeUnlockKey'
  | 'classifiedNumber-out-of-range'
  | 'unknown-wave'
  | 'unknown-tier'
  | 'unknown-family'
  | 'flag-hook-mismatch'
  | 'boardGeometry-mismatch'
  | 'pieceVocabulary-mismatch'
  | 'unknown-codeUnlockKey'
  | 'placeholder-mismatch'
  | 'downstream-registration-failed';

export interface ClassifiedRegistrationErrorDetails {
  readonly kind: ClassifiedRegistrationErrorKind;
  readonly gameId?: string;
  readonly classifiedNumber?: number;
  readonly errors?: readonly string[];
  readonly cause?: unknown;
  readonly message?: string;
}

export class ClassifiedRegistrationError extends Error {
  public readonly kind: ClassifiedRegistrationErrorKind;
  public readonly details: ClassifiedRegistrationErrorDetails;

  constructor(details: ClassifiedRegistrationErrorDetails) {
    super(details.message ?? formatMessage(details));
    this.name = 'ClassifiedRegistrationError';
    this.kind = details.kind;
    this.details = details;
  }
}

function formatMessage(details: ClassifiedRegistrationErrorDetails): string {
  const parts: string[] = [details.kind];
  if (details.gameId) parts.push(`gameId=${details.gameId}`);
  if (details.classifiedNumber !== undefined) parts.push(`classifiedNumber=${String(details.classifiedNumber)}`);
  if (details.errors && details.errors.length > 0) parts.push(details.errors.join('; '));
  return parts.join(' | ');
}

// ---------------------------------------------------------------------------
// Known-family set (runtime companion of the ClassifiedFamily union)
// ---------------------------------------------------------------------------

const KNOWN_FAMILIES: ReadonlySet<string> = new Set<ClassifiedFamily>([
  'Draughts',
  'Stacking Draughts',
  'Capture Game',
  'Hunt Game',
  'Mill Game',
  'Mancala',
  'Race Game',
  'Placement Game',
  'Connection Game',
  'Territory Game',
  'Chess',
  'Shogi',
  'Xiangqi',
  'Janggi',
  'Tafl',
  'Abstract Strategy',
  'Test',
]);

const GAME_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

// ---------------------------------------------------------------------------
// Capability / hook consistency validation
// ---------------------------------------------------------------------------

/**
 * Enforces the one-to-one correspondence between capability flags and
 * optional hooks. Throws `ClassifiedRegistrationError` with
 * `kind: 'flag-hook-mismatch'` on any divergence.
 */
export function validateRuleSetConsistency(rs: ClassifiedRuleSet): void {
  const errors: string[] = [];
  if (rs.hasPiecesInHand && !rs.getLegalDrops)
    errors.push('hasPiecesInHand requires getLegalDrops');
  if (rs.hasPlacementPhase && !rs.getPlacementZones)
    errors.push('hasPlacementPhase requires getPlacementZones');
  if (rs.isAsymmetric && !rs.getRoleLabels)
    errors.push('isAsymmetric requires getRoleLabels');
  if (!rs.hasPiecesInHand && rs.getLegalDrops)
    errors.push('getLegalDrops present without hasPiecesInHand');
  if (!rs.hasPlacementPhase && rs.getPlacementZones)
    errors.push('getPlacementZones present without hasPlacementPhase');
  if (!rs.isAsymmetric && rs.getRoleLabels)
    errors.push('getRoleLabels present without isAsymmetric');
  if (errors.length > 0) {
    throw new ClassifiedRegistrationError({ kind: 'flag-hook-mismatch', errors });
  }
}

// ---------------------------------------------------------------------------
// Spec-shape validation
// ---------------------------------------------------------------------------

/**
 * Validates every structural property of a spec in a single pass. Throws
 * `ClassifiedRegistrationError` with a descriptive `kind` on the first
 * failure; the caller can catch and re-wrap as needed.
 *
 * Duplicate-registration checks are NOT performed here — they require the
 * live registry state (registry.ts handles them as part of the pipeline).
 */
export function validateSpec(
  spec: ClassifiedRegistrationSpec,
  options?: RegistrationOptions,
): void {
  // gameId shape
  if (typeof spec.gameId !== 'string' || !GAME_ID_PATTERN.test(spec.gameId)) {
    throw new ClassifiedRegistrationError({
      kind: 'invalid-gameId',
      gameId: spec.gameId,
      message: `game ids must match /^[a-z][a-z0-9-]*$/ (got "${String(spec.gameId)}")`,
    });
  }

  // classifiedNumber range
  const cn = spec.classifiedNumber;
  const productionRange = Number.isInteger(cn) && cn >= 1 && cn <= 64;
  const tierZeroSlot = options?.allowTierZero === true && (cn === 0 || cn === -1);
  if (!productionRange && !tierZeroSlot) {
    throw new ClassifiedRegistrationError({
      kind: 'classifiedNumber-out-of-range',
      classifiedNumber: cn,
      message: `classifiedNumber must be in 1..64 (got ${String(cn)})`,
    });
  }

  // wave range
  if (!Number.isInteger(spec.wave) || spec.wave < 1 || spec.wave > 8) {
    throw new ClassifiedRegistrationError({
      kind: 'unknown-wave',
      message: `wave must be in 1..8 (got ${String(spec.wave)})`,
    });
  }

  // tier range
  const tierOk =
    (Number.isInteger(spec.tier) && spec.tier >= 1 && spec.tier <= 7) ||
    (options?.allowExpansion === true && spec.tier >= 8 && spec.tier <= 11) ||
    (options?.allowTierZero === true && spec.tier === 0);
  if (!tierOk) {
    throw new ClassifiedRegistrationError({
      kind: 'unknown-tier',
      message: `tier must be in 1..7 (got ${String(spec.tier)})`,
    });
  }

  // family membership
  if (!KNOWN_FAMILIES.has(spec.family)) {
    throw new ClassifiedRegistrationError({
      kind: 'unknown-family',
      message: `family "${spec.family}" is not a known ClassifiedFamily`,
    });
  }

  // ruleSet/spec boardGeometry reference equality
  if (spec.boardGeometry !== spec.ruleSet.boardGeometry) {
    throw new ClassifiedRegistrationError({
      kind: 'boardGeometry-mismatch',
      gameId: spec.gameId,
      message:
        'spec.boardGeometry and ruleSet.boardGeometry must refer to the same BoardGeometry instance',
    });
  }

  // ruleSet/spec pieceVocabularyId reference equality
  if (spec.pieceVocabularyId !== spec.ruleSet.pieceVocabulary.id) {
    throw new ClassifiedRegistrationError({
      kind: 'pieceVocabulary-mismatch',
      gameId: spec.gameId,
      message: 'spec.pieceVocabularyId and ruleSet.pieceVocabulary.id must agree',
    });
  }

  // codeUnlockKey presence in UNLOCK_CODES
  if (!Object.prototype.hasOwnProperty.call(UNLOCK_CODES, spec.codeUnlockKey)) {
    throw new ClassifiedRegistrationError({
      kind: 'unknown-codeUnlockKey',
      message: `codeUnlockKey "${spec.codeUnlockKey}" is not registered in src/data/unlockCodes.ts`,
    });
  }

  // placeholder-mismatch (only for production 1..64 slots)
  if (productionRange) {
    const placeholder = CLASSIFIED_PLACEHOLDER_DATA.find((p) => p.index === cn);
    if (placeholder && placeholder.displayName.trim() !== spec.displayName.trim()) {
      throw new ClassifiedRegistrationError({
        kind: 'placeholder-mismatch',
        classifiedNumber: cn,
        message:
          `classifiedNumber ${String(cn)}: placeholder name "${placeholder.displayName}" ` +
          `does not match registration name "${spec.displayName}"`,
      });
    }
  }

  // capability/hook consistency
  validateRuleSetConsistency(spec.ruleSet);
}
