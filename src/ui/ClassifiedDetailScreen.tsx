/**
 * Classified Detail Screen — per-game placeholder for Classified mode.
 *
 * Phase 3 placeholder: shows game metadata (board geometry, family, wave)
 * and a "Coming Soon" message. Phase 4 will populate this with full rules,
 * board preview, game setup, and historical context.
 */

import ModeScreenShell from './ModeScreenShell';
import { getClassifiedByWave } from '../persistence/gameModeRegistry';
import type { ModeRegistryEntry } from '../persistence/gameModeRegistry';
import styles from './ClassifiedDetailScreen.module.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flatten all classified entries for index-based lookup. */
function findClassifiedEntry(index: number): ModeRegistryEntry | undefined {
  for (let wave = 1; wave <= 8; wave++) {
    const games = getClassifiedByWave(wave);
    const found = games.find((g) => g.classifiedIndex === index);
    if (found) return found;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ClassifiedDetailScreenProps {
  readonly gameIndex: number;
  readonly onBack: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClassifiedDetailScreen({
  gameIndex,
  onBack,
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

  return (
    <ModeScreenShell
      title={entry.displayName}
      onBack={onBack}
      testId="classified-detail-screen"
    >
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
