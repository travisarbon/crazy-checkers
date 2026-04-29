/**
 * Title screen and mode selection.
 *
 * Displays the game title and a grid of mode buttons. Hidden modes
 * (Choice, Classified, Chaos) are revealed dynamically based on
 * the unlock snapshot provided via props.
 */

import { useEffect } from 'react';
import { useAudioManager } from '../audio/useAudioManager';
import { SoundEvent } from '../audio/types';
import type { UnlockSnapshot } from '../persistence/unlockState';
import BrandMark from './BrandMark';
import Icon, { type IconName } from './Icon';
import styles from './MenuScreen.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MenuScreenProps {
  onConfigure: () => void;
  onNavigate: (screenKind: string) => void;
  unlockSnapshot: UnlockSnapshot;
  newlyUnlocked: { choice: boolean; classified: boolean; chaos: boolean };
  onUnlockAnimationEnd: (mode: 'choice' | 'classified' | 'chaos') => void;
  chaosUnlocked: boolean;
}

// ---------------------------------------------------------------------------
// Mode data
// ---------------------------------------------------------------------------

interface ModeEntry {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  /** null = always visible; otherwise, the key in UnlockSnapshot that gates visibility. */
  readonly visibilityGate: keyof UnlockSnapshot | null;
  readonly description: string;
  readonly icon: IconName;
}

const MODES: readonly ModeEntry[] = [
  { id: 'crazy', label: 'Crazy', enabled: true, visibilityGate: null, description: 'Checkers with chaotic events', icon: 'sparkles' },
  { id: 'classic', label: 'Classic', enabled: true, visibilityGate: null, description: 'Standard American Rules Checkers', icon: 'shield' },
  { id: 'challenge', label: 'Challenge', enabled: true, visibilityGate: null, description: 'Timed checkers puzzles', icon: 'puzzle' },
  { id: 'code', label: 'Code', enabled: true, visibilityGate: null, description: 'Enter unlock codes', icon: 'code' },
  { id: 'cogitate', label: 'Cogitate', enabled: true, visibilityGate: null, description: 'Game review and analysis', icon: 'brain' },
  { id: 'career', label: 'Career', enabled: true, visibilityGate: null, description: 'Statistics and progression', icon: 'trophy' },
  { id: 'configure', label: 'Configure', enabled: true, visibilityGate: null, description: 'Settings and themes', icon: 'cog' },
  { id: 'choice', label: 'Choice', enabled: true, visibilityGate: 'choiceUnlocked', description: 'Permanent event checkers', icon: 'crown' },
  { id: 'classified', label: 'Classified', enabled: true, visibilityGate: 'classifiedUnlocked', description: 'World game library', icon: 'stack' },
  { id: 'chaos', label: 'Chaos', enabled: true, visibilityGate: 'chaosUnlocked', description: 'Ultimate chaos checkers', icon: 'chaos' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isModeVisible(mode: ModeEntry, snapshot: UnlockSnapshot): boolean {
  if (mode.visibilityGate === null) return true;
  return snapshot[mode.visibilityGate];
}

/**
 * P3.1 — Margin-Notes-only override of the visibility gate for the
 * Classified tile. Under Margin Notes, the tile must always render so
 * the redaction-bar reveal animation has a label to redact. Under any
 * other theme, the legacy hide-when-locked behaviour is preserved.
 *
 * Reads `document.body.dataset.theme`, the substrate written by
 * `applyTheme` (P3.1 §3.3.1). The gate is structural (does the tile
 * render at all?), not visual; CSS still owns every chrome decision.
 */
function isMarginNotesActive(): boolean {
  return typeof document !== 'undefined' && document.body.dataset.theme === 'margin-notes';
}

function getNewlyUnlockedFlag(
  modeId: string,
  newlyUnlocked: { choice: boolean; classified: boolean; chaos: boolean },
): boolean {
  switch (modeId) {
    case 'choice': return newlyUnlocked.choice;
    case 'classified': return newlyUnlocked.classified;
    case 'chaos': return newlyUnlocked.chaos;
    default: return false;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MenuScreen({
  onConfigure,
  onNavigate,
  unlockSnapshot,
  newlyUnlocked,
  onUnlockAnimationEnd,
  chaosUnlocked,
}: MenuScreenProps) {
  const audioManager = useAudioManager();

  // Play the unlock chime when a mode transitions from hidden to newly visible.
  useEffect(() => {
    if (newlyUnlocked.choice || newlyUnlocked.classified || newlyUnlocked.chaos) {
      audioManager?.play(SoundEvent.UnlockChime);
    }
  }, [newlyUnlocked.choice, newlyUnlocked.classified, newlyUnlocked.chaos, audioManager]);

  // Reduced-motion fallback: immediately mark seen when animation won't fire
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!mq.matches) return;

    if (newlyUnlocked.choice) onUnlockAnimationEnd('choice');
    if (newlyUnlocked.classified) onUnlockAnimationEnd('classified');
    if (newlyUnlocked.chaos) onUnlockAnimationEnd('chaos');
  }, [newlyUnlocked, onUnlockAnimationEnd]);

  function handleModeClick(modeId: string): void {
    audioManager?.play(SoundEvent.MenuClick);
    if (modeId === 'configure') {
      onConfigure();
    } else {
      onNavigate(modeId);
    }
  }

  const marginNotes = isMarginNotesActive();

  return (
    <div className={styles.menuScreen} data-testid="menu-screen" role="main">
      <header>
        <h1 className={styles.gameTitle}>
          {chaosUnlocked ? 'Chaos Checkers' : 'Crazy Checkers'}
          <span
            className={`${styles.wordmarkAnnotation ?? ''} annotation annotation-rotated-lg`}
          >
            {chaosUnlocked ? '(help)' : '(sort of)'}
          </span>
        </h1>
        <p className={`${styles.gameSubtitle ?? ''} ${styles.tagline ?? ''}`}>
          A chaotic twist on a timeless classic
        </p>
      </header>
      <BrandMark className={styles.brandMark ?? ''} />

      <nav className={styles.modeGrid} aria-label="Game modes">
        {(() => {
          const visible = MODES.filter((m) => {
            // P3.1: under Margin Notes, the Classified tile renders even
            // when locked so the redaction-bar reveal has something to
            // redact. The disabled-state below keeps it non-interactive.
            if (m.id === 'classified' && marginNotes) return true;
            return isModeVisible(m, unlockSnapshot);
          });
          const unlockOrder = new Map<string, number>();
          let staggerIndex = 0;
          for (const m of visible) {
            if (getNewlyUnlockedFlag(m.id, newlyUnlocked)) {
              unlockOrder.set(m.id, staggerIndex);
              staggerIndex += 1;
            }
          }
          return visible.map((mode) => {
          const isNewlyUnlocked = getNewlyUnlockedFlag(mode.id, newlyUnlocked);
          const staggerIdx = unlockOrder.get(mode.id) ?? 0;
          const revealStyle = isNewlyUnlocked
            ? { animationDelay: String(staggerIdx * 400) + 'ms' }
            : undefined;
          // P3.1: under Margin Notes, a locked Classified tile renders
          // but is non-interactive. The redaction-bar fade is the
          // visual affordance for "this is locked".
          const classifiedLocked =
            mode.id === 'classified' && marginNotes && !unlockSnapshot.classifiedUnlocked;
          const tileDisabled = !mode.enabled || classifiedLocked;
          return (
            <button
              key={mode.id}
              className={`${styles.modeButton ?? ''} ${tileDisabled ? (styles.disabled ?? '') : ''} ${isNewlyUnlocked ? (styles.unlockReveal ?? '') : ''}`}
              data-mode-tile={mode.id}
              data-classified-locked={classifiedLocked ? '' : undefined}
              disabled={tileDisabled}
              aria-label={
                mode.enabled
                  ? isNewlyUnlocked
                    ? `${mode.label} — newly unlocked`
                    : mode.label
                  : `${mode.label} — Coming Soon`
              }
              title={mode.description}
              style={revealStyle}
              onAnimationEnd={isNewlyUnlocked ? () => { onUnlockAnimationEnd(mode.id as 'choice' | 'classified' | 'chaos'); } : undefined}
              onClick={() => {
                handleModeClick(mode.id);
              }}
            >
              <Icon name={mode.icon} size={28} />
              <span>{mode.label}</span>
              {!mode.enabled && <span className={styles.badge}>Coming Soon</span>}
            </button>
          );
          });
        })()}
      </nav>

      {/* Screen reader announcement for newly unlocked modes */}
      <div aria-live="polite" className={styles.srOnly}>
        {newlyUnlocked.choice && 'Choice mode unlocked!'}
        {newlyUnlocked.classified && 'Classified mode unlocked!'}
        {newlyUnlocked.chaos && 'Chaos mode unlocked! The game title is now Chaos Checkers.'}
      </div>
    </div>
  );
}
