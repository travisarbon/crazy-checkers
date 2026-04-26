/**
 * Allowlist for scripts/audit-css-colors.ts.
 *
 * Each entry is a justified exception. The audit script skips a literal if
 * (file, lineHint ±2, value) matches an entry. The justification is
 * required and is rendered in the PR description when the entry is added.
 *
 * Policy (excerpted from §7 of the task plan):
 *   - An entry is justified only when the literal cannot reasonably be
 *     tokenised (e.g. a hex baked into an SVG data: URI that the regex
 *     stripper cannot detect, a vendor-specific hack that requires a
 *     specific literal).
 *   - Adding an entry is a code-review event. The PR that adds an entry
 *     must describe the alternative tokenisations that were rejected.
 *   - The allowlist is reviewed at every Phase boundary; stale entries are
 *     removed by the maintainer.
 *
 * See: Documentation/UI Overhaul/P2.2-Audit-Hardcoded-Colors.md §7
 */
export interface AllowlistEntry {
  readonly file: string; // relative POSIX path
  readonly lineHint: number; // approximate; ±2 tolerance
  readonly value: string; // exact literal as it appears in the file
  readonly justification: string;
}

export const allowlist: readonly AllowlistEntry[] = [
  // Empty at P2.2 merge. Add entries here only when a literal is genuinely
  // unavoidable (SVG data URI, cross-vendor hack, opt-out comment).
];
