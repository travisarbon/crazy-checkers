/**
 * Code mode — unlock code entry screen.
 *
 * Accepts a user-typed code, validates it against the static mapping table
 * in `src/data/unlockCodes.ts`, writes successful redemptions to both the
 * UnlockEvaluator's codeUnlocks set and the redemption history log, and
 * surfaces contextual feedback (success / already unlocked / invalid).
 */

import { useEffect, useRef, useState } from 'react';
import ModeScreenShell from './ModeScreenShell';
import ExpandableDetailPanel from './ExpandableDetailPanel';
import { lookupCode, normalizeCode } from '../data/unlockCodes';
import {
  addCodeUnlock,
  loadCodeUnlocks,
} from '../persistence/unlockEvaluator';
import {
  appendRedemption,
  loadRedemptionHistory,
  type RedemptionRecord,
} from '../persistence/redemptionHistory';
import styles from './CodeScreen.module.css';

// ---------------------------------------------------------------------------
// Props and local types
// ---------------------------------------------------------------------------

interface CodeScreenProps {
  onBack: () => void;
  onCodeRedeemed?: () => void;
}

type StatusMessage =
  | { readonly kind: 'success'; readonly text: string }
  | { readonly kind: 'already'; readonly text: string }
  | { readonly kind: 'invalid'; readonly text: string };

const AUTO_DISMISS_MS = 5000;
const MAX_INPUT_LENGTH = 32;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diffMs = Math.max(0, now - timestamp);
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${String(diffMin)}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${String(diffHr)}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${String(diffDay)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function classNames(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CodeScreen({ onBack, onCodeRedeemed }: CodeScreenProps) {
  const [inputValue, setInputValue] = useState('');
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [redemptionHistory, setRedemptionHistory] = useState<readonly RedemptionRecord[]>(
    () => loadRedemptionHistory(),
  );
  const [isRedeeming, setIsRedeeming] = useState(false);

  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  function scheduleAutoDismiss(): void {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      setStatusMessage(null);
    }, AUTO_DISMISS_MS);
  }

  function handleInputFocus(): void {
    setStatusMessage(null);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  }

  function handleRedeem(): void {
    if (isRedeeming) return;
    if (inputValue.trim().length === 0) return;

    setIsRedeeming(true);
    const result = lookupCode(inputValue);

    if (!result.found) {
      setStatusMessage({ kind: 'invalid', text: 'Invalid code.' });
      setInputValue('');
      setIsRedeeming(false);
      scheduleAutoDismiss();
      return;
    }

    const currentUnlocks = loadCodeUnlocks();
    const newTargets = result.resolvedTargets.filter((id) => !currentUnlocks.has(id));

    if (newTargets.length === 0) {
      setStatusMessage({
        kind: 'already',
        text: `Already unlocked: ${result.entry.description}.`,
      });
      setInputValue('');
      setIsRedeeming(false);
      scheduleAutoDismiss();
      return;
    }

    for (const targetId of newTargets) {
      addCodeUnlock(targetId);
    }

    const record: RedemptionRecord = {
      code: normalizeCode(inputValue),
      description: result.entry.description,
      newUnlocksCount: newTargets.length,
      timestamp: Date.now(),
    };
    appendRedemption(record);
    setRedemptionHistory(loadRedemptionHistory());

    const countText = newTargets.length > 1 ? ` (${String(newTargets.length)} items)` : '';
    setStatusMessage({
      kind: 'success',
      text: `Unlocked: ${result.entry.description}!${countText}`,
    });
    setInputValue('');
    setIsRedeeming(false);
    onCodeRedeemed?.();
    scheduleAutoDismiss();
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>): void {
    e.preventDefault();
    handleRedeem();
  }

  const submitDisabled = isRedeeming || inputValue.trim().length === 0;

  return (
    <ModeScreenShell title="Code" onBack={onBack} testId="code-screen">
      <section className={styles.section}>
        <p className={styles.intro}>
          Enter an unlock code to reveal hidden Choice, Classified, or Chaos modes.
          Codes are case-insensitive; spaces and punctuation are ignored.
        </p>
        <form className={styles.entryForm} onSubmit={handleSubmit}>
          <input
            className={styles.codeInput}
            type="text"
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); }}
            onFocus={handleInputFocus}
            placeholder="Enter unlock code..."
            aria-label="Unlock code"
            maxLength={MAX_INPUT_LENGTH}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            data-testid="code-input"
          />
          <button
            className={styles.redeemButton}
            type="submit"
            disabled={submitDisabled}
            data-testid="redeem-button"
          >
            Redeem
          </button>
        </form>

        {statusMessage !== null && (
          <div
            className={classNames(styles.status, styles[statusMessage.kind])}
            role="status"
            aria-live="polite"
            data-testid="status-message"
          >
            {statusMessage.kind === 'success' && (
              <span className={styles.checkmark} aria-hidden="true">✓</span>
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </section>

      <ExpandableDetailPanel
        title="Redemption History"
        defaultExpanded={false}
        ariaLabel="Redemption history panel"
      >
        {redemptionHistory.length === 0 ? (
          <p className={styles.emptyHistory} data-testid="history-empty">
            No codes redeemed yet.
          </p>
        ) : (
          <ul className={styles.historyList} role="list" data-testid="history-list">
            {[...redemptionHistory].reverse().map((record) => (
              <li
                key={`${record.code}-${String(record.timestamp)}`}
                className={styles.historyItem}
                role="listitem"
              >
                <span className={styles.historyCode}>{record.code}</span>
                <span className={styles.historyDescription}>{record.description}</span>
                <span className={styles.historyTime}>
                  {formatRelativeTime(record.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ExpandableDetailPanel>
    </ModeScreenShell>
  );
}
