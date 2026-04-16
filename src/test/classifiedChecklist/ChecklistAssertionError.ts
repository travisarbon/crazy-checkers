/**
 * Task 27.7 — structured error thrown by the Classified §13 Review Checklist
 * mechanical helpers (assertGameRegistrationInvariants,
 * assertGameSerializerRoundTrip, ...).
 *
 * Every failure string is prefixed with the checklist ID + clause letter so a
 * reviewer can jump from the CI log straight to the checklist row.
 */

export interface ChecklistAssertionErrorArgs {
  readonly gameId: string;
  readonly failures: readonly string[];
}

export class ChecklistAssertionError extends Error {
  readonly name = 'ChecklistAssertionError';
  readonly gameId: string;
  readonly failures: readonly string[];

  constructor({ gameId, failures }: ChecklistAssertionErrorArgs) {
    super(
      `Checklist failed for "${gameId}":\n  - ${failures.join('\n  - ')}`,
    );
    this.gameId = gameId;
    this.failures = Object.freeze([...failures]);
  }
}
