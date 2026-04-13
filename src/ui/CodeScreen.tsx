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
import EmptyStateIllustration from './EmptyStateIllustration';
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

      <section
        aria-label="What codes unlock"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          padding: '1rem',
          border: '1px solid color-mix(in srgb, var(--ui-accent) 25%, transparent)',
          borderRadius: 'var(--radius-lg, 10px)',
          background: 'color-mix(in srgb, var(--ui-accent) 4%, transparent)',
        }}
      >
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <EmptyStateIllustration
            variant="checkmark"
            size={48}
            style={{ color: 'var(--ui-accent)', flexShrink: 0 }}
          />
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--ui-accent)' }}>
              What codes can unlock
            </h3>
            <p
              style={{
                margin: '0.15rem 0 0',
                fontSize: '0.85rem',
                opacity: 0.75,
              }}
            >
              Share or discover codes to skip unlock requirements for these
              three mode categories.
            </p>
          </div>
        </div>
        {([
          {
            title: 'Choice modes',
            desc: '40 permanent-event checkers variants normally earned via unlock tracks.',
          },
          {
            title: 'Classified games',
            desc: '64 abstract strategy games normally unlocked by defeating Hard CPU.',
          },
          {
            title: 'Chaos mode',
            desc: 'The ultimate chaos experience, normally gated by full career progress.',
          },
        ] as const).map((row) => (
          <div
            key={row.title}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              padding: '0.65rem 0.75rem',
              background: 'var(--ui-surface, transparent)',
              border: '1px solid color-mix(in srgb, var(--ui-accent) 20%, transparent)',
              borderRadius: 'var(--radius-md, 6px)',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ui-accent)' }}>
              {row.title}
            </span>
            <span style={{ fontSize: '0.8rem', opacity: 0.8, lineHeight: 1.35 }}>
              {row.desc}
            </span>
          </div>
        ))}
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
