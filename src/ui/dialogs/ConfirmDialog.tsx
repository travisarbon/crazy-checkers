/**
 * Reusable in-game confirmation dialog.
 *
 * Replaces native `window.confirm` for destructive actions like
 * Resign and New Game, keeping the UI consistent with other dialogs.
 *
 * Accessibility: role="alertdialog", aria-modal, focus trap, scroll lock, Escape to cancel.
 */

import { useEffect, useRef } from 'react';
import styles from './ConfirmDialog.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
  /** Dialog heading text. */
  title: string;
  /** Descriptive message shown below the heading. */
  message: string;
  /** Label for the confirm button. */
  confirmLabel: string;
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Called when the user confirms the action. */
  onConfirm: () => void;
  /** Called when the user cancels (button click or Escape). */
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Auto-focus the confirm button after the slide-up animation
  useEffect(() => {
    const timer = setTimeout(() => {
      confirmRef.current?.focus();
    }, 300);
    return () => { clearTimeout(timer); };
  }, []);

  // Prevent background scrolling
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Focus trap + Escape to cancel
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onCancel();
      return;
    }

    if (e.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled])',
    );
    if (!focusable || focusable.length === 0) return;

    if (focusable.length === 1) {
      e.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <div className={styles.backdrop} aria-hidden="true" data-testid="confirm-backdrop" />
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onKeyDown={handleKeyDown}
        data-testid="confirm-dialog"
      >
        <h2 id="confirm-title" className={styles.heading}>
          {title}
        </h2>
        <p id="confirm-message" className={styles.message}>
          {message}
        </p>
        <div className={styles.actions}>
          <button
            className={styles.secondaryButton}
            onClick={onCancel}
            data-testid="confirm-cancel"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            className={styles.primaryButton}
            onClick={onConfirm}
            data-testid="confirm-confirm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
