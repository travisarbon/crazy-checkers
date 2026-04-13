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

  return (
    <div className={styles.menuScreen} data-testid="menu-screen" role="main">
      <header>
        <h1 className={styles.gameTitle}>
          {chaosUnlocked ? 'Chaos Checkers' : 'Crazy Checkers'}
        </h1>
        <p className={styles.gameSubtitle}>A chaotic twist on a timeless classic</p>
      </header>

      <nav className={styles.modeGrid} aria-label="Game modes">
        {MODES.filter((m) => isModeVisible(m, unlockSnapshot)).map((mode) => {
          const isNewlyUnlocked = getNewlyUnlockedFlag(mode.id, newlyUnlocked);
          return (
            <button
              key={mode.id}
              className={`${styles.modeButton ?? ''} ${!mode.enabled ? (styles.disabled ?? '') : ''} ${isNewlyUnlocked ? (styles.unlockReveal ?? '') : ''}`}
              disabled={!mode.enabled}
              aria-label={mode.enabled ? mode.label : `${mode.label} — Coming Soon`}
              title={mode.description}
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
        })}
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
