/**
 * Settings and configuration screen.
 * Provides theme picker, animation speed slider, move confirmation toggle,
 * and placeholder data management buttons.
 */

import type { Settings } from './settings';
import { THEMES } from '../themes/theme';
import BoardPreview from './BoardPreview';
import styles from './ConfigScreen.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConfigScreenProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

function ThemeSection({
  selectedThemeId,
  onSelect,
}: {
  selectedThemeId: string;
  onSelect: (id: Settings['themeId']) => void;
}) {
  const themeEntries = Object.entries(THEMES);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const cards = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    const currentIndex = Array.from(cards).findIndex((c) => c === document.activeElement);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % cards.length;
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + cards.length) % cards.length;
      e.preventDefault();
    }

    if (nextIndex !== currentIndex) {
      const card = cards[nextIndex];
      if (card) {
        card.focus();
        const id = card.dataset.themeId;
        if (id) onSelect(id as Settings['themeId']);
      }
    }
  }

  return (
    <section className={styles.section} aria-labelledby="theme-heading">
      <h2 id="theme-heading" className={styles.sectionTitle}>Theme</h2>
      <div
        className={styles.themeGrid}
        role="radiogroup"
        aria-label="Theme selection"
        onKeyDown={handleKeyDown}
      >
        {themeEntries.map(([id, theme]) => {
          const cardClass = [
            styles.themeCard,
            id === selectedThemeId ? styles.themeCardSelected : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={id}
              className={cardClass}
              role="radio"
              aria-checked={id === selectedThemeId}
              aria-label={theme.name}
              data-theme-id={id}
              tabIndex={id === selectedThemeId ? 0 : -1}
              onClick={() => { onSelect(id as Settings['themeId']); }}
            >
              <BoardPreview theme={theme} size={80} />
              <span className={styles.themeLabel}>{theme.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AnimationSpeedSection({
  speed,
  onChange,
}: {
  speed: number;
  onChange: (speed: number) => void;
}) {
  const displayedValue = 2.5 - speed;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const displayed = parseFloat(e.target.value);
    onChange(Math.round((2.5 - displayed) * 10) / 10);
  }

  const speedLabel =
    speed <= 0.6 ? 'Fast' :
    speed <= 0.8 ? 'Slightly fast' :
    speed <= 1.2 ? 'Normal' :
    speed <= 1.6 ? 'Slightly slow' :
    'Slow';

  return (
    <section className={styles.section} aria-labelledby="anim-speed-heading">
      <h2 id="anim-speed-heading" className={styles.sectionTitle}>
        Animation Speed
      </h2>
      <div className={styles.sliderRow}>
        <label htmlFor="anim-speed-slider" className={styles.sliderLabel}>
          Slow
        </label>
        <input
          id="anim-speed-slider"
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={displayedValue}
          onChange={handleChange}
          className={styles.slider}
          aria-valuetext={speedLabel}
          aria-label="Animation speed"
        />
        <span className={styles.sliderLabel}>Fast</span>
      </div>
      <p className={styles.sliderHint}>{speedLabel}</p>
    </section>
  );
}

function MoveConfirmationSection({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <section className={styles.section} aria-labelledby="move-confirm-heading">
      <h2 id="move-confirm-heading" className={styles.sectionTitle}>
        Move Confirmation
      </h2>
      <div className={styles.toggleRow}>
        <label htmlFor="move-confirm-toggle" className={styles.toggleLabel}>
          Require confirmation before executing a move
        </label>
        <button
          id="move-confirm-toggle"
          role="switch"
          aria-checked={enabled}
          className={[styles.toggleSwitch, enabled ? styles.toggleOn : ''].filter(Boolean).join(' ')}
          onClick={() => { onChange(!enabled); }}
        >
          <span className={styles.toggleKnob} />
        </button>
      </div>
      <p className={styles.settingHint}>
        When enabled, selecting a destination highlights it and requires a second
        click to confirm. Press Escape or click elsewhere to cancel.
      </p>
    </section>
  );
}

function DataSection() {
  return (
    <section className={styles.section} aria-labelledby="data-heading">
      <h2 id="data-heading" className={styles.sectionTitle}>Data</h2>
      <div className={styles.dataButtons}>
        <button
          className={styles.dataButton}
          disabled
          title="Coming in a future update"
        >
          Export Data
        </button>
        <button
          className={[styles.dataButton, styles.dangerButton].filter(Boolean).join(' ')}
          disabled
          title="Coming in a future update"
        >
          Reset Progress
        </button>
      </div>
      <p className={styles.settingHint}>
        Data management features will be available in a future update.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// ConfigScreen
// ---------------------------------------------------------------------------

export default function ConfigScreen({
  settings,
  onSettingsChange,
  onBack,
}: ConfigScreenProps) {
  const setTheme = (themeId: Settings['themeId']) => {
    onSettingsChange({ ...settings, themeId });
  };

  const setAnimationSpeed = (speed: number) => {
    onSettingsChange({ ...settings, animationSpeed: speed });
  };

  const setMoveConfirmation = (enabled: boolean) => {
    onSettingsChange({ ...settings, moveConfirmation: enabled });
  };

  return (
    <div className={styles.configScreen} data-testid="config-screen">
      <header className={styles.header}>
        <button
          className={styles.backButton}
          onClick={onBack}
          aria-label="Back to main menu"
        >
          &larr; Back
        </button>
        <h1 className={styles.title}>Configure</h1>
      </header>

      <div className={styles.sections}>
        <ThemeSection
          selectedThemeId={settings.themeId}
          onSelect={setTheme}
        />

        <AnimationSpeedSection
          speed={settings.animationSpeed}
          onChange={setAnimationSpeed}
        />

        <MoveConfirmationSection
          enabled={settings.moveConfirmation}
          onChange={setMoveConfirmation}
        />

        <DataSection />
      </div>
    </div>
  );
}
