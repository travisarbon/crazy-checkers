import { describe, expect, it } from 'vitest';
import {
  ClassifiedRegistrationError,
  validateRuleSetConsistency,
  validateSpec,
  type ClassifiedRegistrationSpec,
} from './registrationSpec';
import {
  asClassifiedGameId,
  type ClassifiedRuleSet,
} from './ClassifiedRuleSet';
import { asAudioPackId } from './pieceVocabulary';
import { testCheckersCloneRuleSet } from './tier0/testCheckersClone';
import { testShogiCloneRuleSet } from './tier0/testShogiClone';

function baseSpec(): ClassifiedRegistrationSpec {
  return {
    gameId: asClassifiedGameId('russian-draughts'),
    classifiedNumber: 1,
    wave: 1,
    tier: 1,
    family: 'Draughts',
    displayName: 'Russian Draughts',
    ruleSet: {
      ...testCheckersCloneRuleSet,
      gameId: asClassifiedGameId('russian-draughts'),
    },
    boardGeometry: testCheckersCloneRuleSet.boardGeometry,
    pieceVocabularyId: testCheckersCloneRuleSet.pieceVocabulary.id,
    audioPackId: asAudioPackId('default-draughts'),
    codeUnlockKey: 'CLASSIFIED01',
    narrativeFlavor: { wave: 'Wave 1', family: 'Draughts', connection: 'ancestor' },
  };
}

describe('validateSpec — happy path', () => {
  it('accepts a production-range spec (classifiedNumber 1..64)', () => {
    expect(() => {
      validateSpec(baseSpec());
    }).not.toThrow();
  });

  it('accepts Tier 0 fixtures with allowTierZero', () => {
    const spec = { ...baseSpec(), classifiedNumber: 0, tier: 1, codeUnlockKey: 'TESTTIERZERO' };
    expect(() => {
      validateSpec(spec, { allowTierZero: true });
    }).not.toThrow();
  });
});

describe('validateSpec — rejection kinds', () => {
  function throwsKind(
    mutate: (s: ClassifiedRegistrationSpec) => ClassifiedRegistrationSpec,
    kind: string,
    options?: Parameters<typeof validateSpec>[1],
  ): void {
    let err: unknown;
    try {
      validateSpec(mutate(baseSpec()), options);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ClassifiedRegistrationError);
    expect((err as ClassifiedRegistrationError).kind).toBe(kind);
  }

  it('invalid-gameId — capital letters', () => {
    throwsKind((s) => ({ ...s, gameId: asClassifiedGameId('Russian-Draughts') }), 'invalid-gameId');
  });

  it('invalid-gameId — empty string', () => {
    throwsKind((s) => ({ ...s, gameId: asClassifiedGameId('') }), 'invalid-gameId');
  });

  it('classifiedNumber-out-of-range — 65', () => {
    throwsKind((s) => ({ ...s, classifiedNumber: 65 }), 'classifiedNumber-out-of-range');
  });

  it('classifiedNumber-out-of-range — 0 without allowTierZero', () => {
    throwsKind((s) => ({ ...s, classifiedNumber: 0 }), 'classifiedNumber-out-of-range');
  });

  it('unknown-wave — 0', () => {
    throwsKind((s) => ({ ...s, wave: 0 }), 'unknown-wave');
  });

  it('unknown-wave — 9', () => {
    throwsKind((s) => ({ ...s, wave: 9 }), 'unknown-wave');
  });

  it('unknown-tier — 8 without allowExpansion', () => {
    throwsKind((s) => ({ ...s, tier: 8 }), 'unknown-tier');
  });

  it('unknown-family — unrecognised value', () => {
    throwsKind(
      (s) => ({ ...s, family: 'Not A Family' as unknown as ClassifiedRegistrationSpec['family'] }),
      'unknown-family',
    );
  });

  it('boardGeometry-mismatch — spec and rule-set geometries diverge', () => {
    throwsKind(
      (s) => ({
        ...s,
        boardGeometry: { ...testCheckersCloneRuleSet.boardGeometry } as typeof s.boardGeometry,
      }),
      'boardGeometry-mismatch',
    );
  });

  it('pieceVocabulary-mismatch — spec id does not match rule set', () => {
    throwsKind(
      (s) => ({ ...s, pieceVocabularyId: ('other' as unknown) as typeof s.pieceVocabularyId }),
      'pieceVocabulary-mismatch',
    );
  });

  it('unknown-codeUnlockKey — key missing from UNLOCK_CODES', () => {
    throwsKind((s) => ({ ...s, codeUnlockKey: 'NEVER_REGISTERED_KEY' }), 'unknown-codeUnlockKey');
  });

  it('placeholder-mismatch — displayName differs from placeholder', () => {
    throwsKind(
      (s) => ({ ...s, displayName: 'A Totally Different Name' }),
      'placeholder-mismatch',
    );
  });

  it('flag-hook-mismatch — hasPiecesInHand without getLegalDrops', () => {
    const bad: ClassifiedRuleSet = {
      ...testCheckersCloneRuleSet,
      hasPiecesInHand: true,
    };
    throwsKind((s) => ({ ...s, ruleSet: bad }), 'flag-hook-mismatch');
  });

  it('flag-hook-mismatch — getLegalDrops without hasPiecesInHand', () => {
    const bad: ClassifiedRuleSet = {
      ...testCheckersCloneRuleSet,
      hasPiecesInHand: false,
      getLegalDrops: () => [],
    };
    throwsKind((s) => ({ ...s, ruleSet: bad }), 'flag-hook-mismatch');
  });
});

describe('validateRuleSetConsistency', () => {
  it('accepts the consistent checkers-clone fixture', () => {
    expect(() => {
      validateRuleSetConsistency(testCheckersCloneRuleSet);
    }).not.toThrow();
  });

  it('accepts the consistent hand-bearing shogi-clone fixture', () => {
    expect(() => {
      validateRuleSetConsistency(testShogiCloneRuleSet);
    }).not.toThrow();
  });

  it('reports each mismatch for a maximally inconsistent rule set', () => {
    const bad: ClassifiedRuleSet = {
      ...testCheckersCloneRuleSet,
      hasPiecesInHand: true,
      hasPlacementPhase: true,
      isAsymmetric: true,
    };
    let err: unknown;
    try {
      validateRuleSetConsistency(bad);
    } catch (e) {
      err = e;
    }
    expect((err as ClassifiedRegistrationError).details.errors?.length).toBeGreaterThanOrEqual(3);
  });
});

describe('ClassifiedRegistrationError', () => {
  it('carries the kind and details through the Error instance', () => {
    const err = new ClassifiedRegistrationError({
      kind: 'duplicate-gameId',
      gameId: 'x',
    });
    expect(err.kind).toBe('duplicate-gameId');
    expect(err.details.gameId).toBe('x');
    expect(err.name).toBe('ClassifiedRegistrationError');
  });
});
