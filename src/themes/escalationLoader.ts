/**
 * P4.2 — Conditional escalation-CSS loader.
 *
 * The Margin Notes mode-tiered escalation chrome lives in a separate
 * stylesheet that is loaded only for users on the Margin Notes theme.
 * This keeps Cork/Current/Classic/Contrast/crazy-original users free
 * of any escalation-related bytes (per parent plan §5 P4.2).
 *
 * The loader is idempotent: the first call for `margin-notes` triggers
 * the dynamic import; subsequent calls (for any theme) are no-ops once
 * the stylesheet has been injected. Vite's module cache makes the
 * dynamic import cheap on second access.
 */

let escalationLoaded = false;

/**
 * Returns true once `ensureEscalationLoaded('margin-notes')` has
 * resolved at least once. Used by tests to assert idempotency.
 */
export function isEscalationLoaded(): boolean {
  return escalationLoaded;
}

/**
 * Lazily injects the Margin Notes escalation stylesheet. No-op for any
 * theme other than `margin-notes`; no-op on subsequent calls once the
 * stylesheet is loaded.
 *
 * Returns a promise that resolves after the stylesheet has been
 * injected (or immediately for non-margin-notes themes / repeat calls).
 * Callers typically `void` the promise — the user-visible chrome change
 * happens on the next paint, which is fine because the existing P3
 * Margin Notes chrome holds during the (single-digit-ms) gap.
 */
export async function ensureEscalationLoaded(themeId: string): Promise<void> {
  if (themeId !== 'margin-notes' || escalationLoaded) return;
  escalationLoaded = true;
  try {
    await import('./marginnotes.escalation.css');
  } catch (err) {
    // Reset the flag so a future retry can succeed; surface the error
    // to the console so the cause is debuggable. We do not throw —
    // the chrome gracefully degrades to the unescalated Margin Notes
    // look (which is still a valid, complete visual identity).
    escalationLoaded = false;
    if (typeof console !== 'undefined') {
      console.warn('[escalationLoader] failed to load Margin Notes escalation CSS:', err);
    }
  }
}

/**
 * Test-only: resets the loaded flag. Used by escalationLoader.test.ts
 * to verify idempotency across multiple test cases. Not exported in
 * production builds (the dev-only branch in the test file imports
 * this directly).
 */
export function __resetEscalationLoadedForTests(): void {
  escalationLoaded = false;
}
