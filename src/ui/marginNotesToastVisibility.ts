/**
 * P6.4 — Pure visibility predicate for the Margin Notes one-time toast.
 *
 * Lives outside MarginNotesToast.tsx so the component file can satisfy
 * react-refresh/only-export-components (Fast Refresh requires component
 * files to export only components).
 */

import type { Settings } from './settings';

/** 30 days in ms — the toast's auto-expiry window per parent plan §P6.4. */
export const MARGIN_NOTES_TOAST_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function shouldShowMarginNotesToast(
  settings: Settings,
  now: number = Date.now(),
): boolean {
  if (settings.themeId === 'margin-notes') return false;
  if (settings.marginNotesToastDismissed) return false;
  if (
    settings.marginNotesToastFirstSeenAt !== null &&
    now - settings.marginNotesToastFirstSeenAt > MARGIN_NOTES_TOAST_TTL_MS
  ) {
    return false;
  }
  return true;
}
