/**
 * Classified Detail Screen — per-game entry point for Classified mode.
 *
 * Task 27.8 upgrade: when the game's `ClassifiedGameId` resolves to a
 * registered entry in the Classified registry, render a live MVP layout
 * (rule summary + inline GameSetupSection + Start Game). Unregistered
 * games keep the Phase 3 "Coming Soon" placeholder unchanged.
 */

import ModeScreenShell from './ModeScreenShell';
import GameSetupSection from './GameSetupSection';
import { getClassifiedByWave } from '../persistence/gameModeRegistry';
import type { ModeRegistryEntry } from '../persistence/gameModeRegistry';
import { getClassifiedGame } from '../engine/classified/registry';
import type { ClassifiedGameId } from '../engine/classified/ClassifiedRuleSet';
import { asClassifiedGameId } from '../engine/classified/ClassifiedRuleSet';
import { GameMode } from '../engine/types';
import type { PlayerSetup } from '../engine/types';
import type { TimeControlConfig } from '../engine/clock';
import styles from './ClassifiedDetailScreen.module.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Flatten all classified entries for index-based lookup. When both a
 * placeholder (`implemented: false`) and a live-registered entry share the
 * same classifiedIndex, prefer the live-registered one so Task 27.8 routes
 * through the registered branch.
 */
function findClassifiedEntry(index: number): ModeRegistryEntry | undefined {
  let placeholder: ModeRegistryEntry | undefined;
  for (let wave = 1; wave <= 8; wave++) {
    const games = getClassifiedByWave(wave);
    for (const entry of games) {
      if (entry.classifiedIndex !== index) continue;
      if (entry.implemented) return entry;
      placeholder = entry;
    }
  }
  return placeholder;
}

/**
 * Extract the `ClassifiedGameId` (kebab-case game id) from a registry mode
 * entry id. `_registerClassifiedMode` stamps IDs as `classified-<gameId>`.
 */
function extractGameId(entry: ModeRegistryEntry): ClassifiedGameId | null {
  const PREFIX = 'classified-';
  if (!entry.id.startsWith(PREFIX)) return null;
  const suffix = entry.id.slice(PREFIX.length);
  // Placeholder entries use numeric suffixes (e.g. "classified-1"). Live
  // registrations use kebab-case game ids (e.g. "classified-russian-draughts")
  // — we only want the live form.
  if (/^\d+$/.test(suffix)) return null;
  return asClassifiedGameId(suffix);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ClassifiedDetailScreenProps {
  readonly gameIndex: number;
  readonly onBack: () => void;
  readonly onStartGame?: (
    gameId: ClassifiedGameId,
    players: PlayerSetup,
    flipped: boolean,
    timeControl: TimeControlConfig | null,
  ) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClassifiedDetailScreen({
  gameIndex,
  onBack,
  onStartGame,
}: ClassifiedDetailScreenProps) {
  const entry = findClassifiedEntry(gameIndex);

  if (!entry) {
    return (
      <ModeScreenShell
        title="Classified"
        onBack={onBack}
        testId="classified-detail-screen"
      >
        <p className={styles.errorState}>
          Game not found. Please return to the gallery and select a valid game.
        </p>
      </ModeScreenShell>
    );
  }

  const gameId = extractGameId(entry);
  const registered =
    entry.implemented && gameId !== null ? getClassifiedGame(gameId) : null;

  const metadata = (
    <div className={styles.infoCard}>
      <div className={styles.infoRow}>
        <span className={styles.infoLabel}>Board:</span>
        <span>{entry.boardGeometry ?? 'Standard'}</span>
      </div>
      <div className={styles.infoRow}>
        <span className={styles.infoLabel}>Family:</span>
        <span>{entry.family ?? 'Unknown'}</span>
      </div>
      <div className={styles.infoRow}>
        <span className={styles.infoLabel}>Wave:</span>
        <span>
          {entry.wave !== null ? `Wave ${String(entry.wave)}` : ''}
        </span>
      </div>
    </div>
  );

  if (registered && gameId !== null && onStartGame) {
    const ruleSummary =
      registered.mvpRuleSummary?.trim() ?? 'Rules coming soon.';
    const handleStartGame = (
      players: PlayerSetup,
      flipped: boolean,
      _mode: GameMode,
      timeControl: TimeControlConfig | null,
    ): void => {
      onStartGame(gameId, players, flipped, timeControl);
    };
    return (
      <ModeScreenShell
        title={entry.displayName}
        onBack={onBack}
        testId="classified-detail-screen"
      >
        {metadata}
        <p className={styles.ruleSummary} data-testid="classified-rule-summary">
          {ruleSummary}
        </p>
        <GameSetupSection
          mode={GameMode.Classic}
          defaultTimeControl={null}
          onStartGame={handleStartGame}
        />
      </ModeScreenShell>
    );
  }

  return (
    <ModeScreenShell
      title={entry.displayName}
      onBack={onBack}
      testId="classified-detail-screen"
    >
      {metadata}
      <div className={styles.comingSoon}>
        <p className={styles.comingSoonTitle}>Coming Soon</p>
        <p className={styles.comingSoonText}>
          {entry.displayName} is being prepared for a future update. Check back
          soon for full rules, historical context, and playable games.
        </p>
      </div>
    </ModeScreenShell>
  );
}
