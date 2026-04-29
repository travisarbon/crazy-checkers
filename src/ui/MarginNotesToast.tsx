/**
 * P6.4 — One-time toast inviting returning users to try the new
 * Margin Notes default theme.
 *
 * Render conditions (all must hold):
 *   - The active theme is NOT margin-notes (the user is on a non-default theme).
 *   - settings.marginNotesToastDismissed is false.
 *   - settings.marginNotesToastFirstSeenAt is null OR was set fewer than
 *     30 days ago.
 *
 * On first render, the component sets `marginNotesToastFirstSeenAt = now`
 * via onSettingsChange. On Try-it, it switches the active theme to
 * margin-notes (via the existing settings update path) and dismisses.
 * On Dismiss (or Esc), it sets `marginNotesToastDismissed = true`.
 *
 * Accessibility:
 *   - aria-live="polite" so screen readers announce without interrupting.
 *   - First focus lands on the "Try it" button.
 *   - Esc key dismisses.
 *   - Slide-in animation is replaced with a fade under prefers-reduced-motion.
 */

import { useEffect, useRef } from 'react';
import type { Settings } from './settings';
import { shouldShowMarginNotesToast } from './marginNotesToastVisibility';
import styles from './MarginNotesToast.module.css';

interface MarginNotesToastProps {
  readonly settings: Settings;
  readonly onSettingsChange: (settings: Settings) => void;
}

export default function MarginNotesToast({
  settings,
  onSettingsChange,
}: MarginNotesToastProps) {
  const tryItRef = useRef<HTMLButtonElement | null>(null);
  const visible = shouldShowMarginNotesToast(settings);

  // First-render timestamp stamping. Only fires when the toast goes
  // from invisible → visible AND firstSeenAt is null. The timestamp is
  // stable across the toast's lifetime (we don't re-stamp on every
  // re-render).
  useEffect(() => {
    if (!visible) return;
    if (settings.marginNotesToastFirstSeenAt !== null) return;
    onSettingsChange({ ...settings, marginNotesToastFirstSeenAt: Date.now() });
  }, [visible, settings, onSettingsChange]);

  // Focus the "Try it" button when the toast first becomes visible.
  useEffect(() => {
    if (visible) tryItRef.current?.focus();
  }, [visible]);

  // Esc dismisses.
  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onSettingsChange({ ...settings, marginNotesToastDismissed: true });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [visible, settings, onSettingsChange]);

  if (!visible) return null;

  return (
    <div
      className={styles.toast}
      role="status"
      aria-live="polite"
      aria-label="A new look is available"
      data-testid="margin-notes-toast"
    >
      <p className={styles.body}>
        We refreshed the look. Your saved theme is preserved — try the new default
        in Configure → Themes.
      </p>
      <div className={styles.actions}>
        <button
          ref={tryItRef}
          type="button"
          className={[styles.button ?? '', styles.primary ?? '', 'ui-btn', 'ui-btn--primary']
            .filter(Boolean)
            .join(' ')}
          data-testid="margin-notes-toast-try"
          onClick={() => {
            onSettingsChange({
              ...settings,
              themeId: 'margin-notes',
              marginNotesToastDismissed: true,
            });
          }}
        >
          Try it
        </button>
        <button
          type="button"
          className={[styles.button ?? '', styles.dismiss ?? '', 'ui-btn', 'ui-btn--tertiary']
            .filter(Boolean)
            .join(' ')}
          data-testid="margin-notes-toast-dismiss"
          onClick={() => {
            onSettingsChange({ ...settings, marginNotesToastDismissed: true });
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
