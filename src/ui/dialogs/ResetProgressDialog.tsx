/**
 * ResetProgressDialog — two-step confirmation for wiping all persisted
 * user data (settings, game history, challenge progress, unlocks, etc.).
 *
 * Step 1: explain what will be erased; offer Cancel / Continue.
 * Step 2: require the user to type RESET before the destructive button
 *         becomes enabled. This adds deliberate friction that
 *         prevents accidental reset even if a user clicks through the
 *         first dialog without reading it.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './ConfirmDialog.module.css';

const REQUIRED_CONFIRMATION_TEXT = 'RESET';

interface ResetProgressDialogProps {
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

type Step = 'warn' | 'type';

export default function ResetProgressDialog({
  onConfirm,
  onCancel,
}: ResetProgressDialogProps) {
  const [step, setStep] = useState<Step>('warn');
  const [typed, setTyped] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the primary actionable control on each step.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (step === 'warn') {
        continueRef.current?.focus();
      } else {
        inputRef.current?.focus();
      }
    }, 50);
    return () => { clearTimeout(timer); };
  }, [step]);

  // Prevent background scrolling while the dialog is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onCancel();
    }
  }

  if (step === 'warn') {
    return (
      <>
        <div className={styles.backdrop} aria-hidden="true" data-testid="reset-backdrop" />
        <div
          ref={dialogRef}
          className={styles.dialog}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="reset-title"
          aria-describedby="reset-message"
          onKeyDown={handleKeyDown}
          data-testid="reset-dialog-step-1"
        >
          <h2 id="reset-title" className={styles.heading}>
            Reset all progress?
          </h2>
          <p id="reset-message" className={styles.message}>
            This permanently erases your settings, saved game, completed
            game history, challenge progress, and every code-redeemed
            unlock on this device. The app will reload afterwards.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onCancel}
              data-testid="reset-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              ref={continueRef}
              className={styles.primaryButton}
              onClick={() => { setStep('type'); }}
              data-testid="reset-continue"
            >
              Continue…
            </button>
          </div>
        </div>
      </>
    );
  }

  const canConfirm = typed === REQUIRED_CONFIRMATION_TEXT;

  return (
    <>
      <div className={styles.backdrop} aria-hidden="true" data-testid="reset-backdrop" />
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        aria-describedby="reset-message"
        onKeyDown={handleKeyDown}
        data-testid="reset-dialog-step-2"
      >
        <h2 id="reset-title" className={styles.heading}>
          Type {REQUIRED_CONFIRMATION_TEXT} to confirm
        </h2>
        <p id="reset-message" className={styles.message}>
          This action cannot be undone. Type {REQUIRED_CONFIRMATION_TEXT} in
          the field below to enable the confirm button.
        </p>
        <label
          htmlFor="reset-confirm-input"
          style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}
        >
          Confirmation
        </label>
        <input
          id="reset-confirm-input"
          ref={inputRef}
          type="text"
          value={typed}
          onChange={(e) => { setTyped(e.target.value); }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={REQUIRED_CONFIRMATION_TEXT}
          data-testid="reset-type-input"
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            fontSize: '1rem',
            fontFamily: 'inherit',
            background: 'var(--ui-bg)',
            color: 'var(--ui-text)',
            border: '1px solid var(--ui-border)',
            borderRadius: 'var(--radius-md)',
            boxSizing: 'border-box',
          }}
        />
        <div className={styles.actions} style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onCancel}
            data-testid="reset-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onConfirm}
            disabled={!canConfirm}
            data-testid="reset-confirm"
          >
            Reset Everything
          </button>
        </div>
      </div>
    </>
  );
}
