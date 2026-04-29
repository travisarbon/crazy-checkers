/**
 * Settings and configuration screen.
 * Provides theme picker, animation speed slider, move confirmation toggle,
 * and data management (Export / Import / Reset Progress).
 */

import { useRef, useState } from 'react';
import type { Settings } from './settings';
import type { AudioManager } from '../audio/audioManager';
import { THEMES } from '../themes/theme';
import { useAudioManager } from '../audio/useAudioManager';
import { SoundEvent } from '../audio/types';
import BoardPreview from './BoardPreview';
import TimeControlSection from './TimeControlSection';
import ModeScreenShell from './ModeScreenShell';
import ResetProgressDialog from './dialogs/ResetProgressDialog';
import {
  exportAll,
  serializeExportEnvelope,
  parseExportEnvelope,
  importAll,
  resetAll,
} from '../persistence/dataManagement';
import { coerceEscalationOnThemeChange } from '../persistence/settings';
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
      <h2 id="theme-heading" className={styles.sectionTitle}>
        Theme
      </h2>
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
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={id}
              className={cardClass}
              role="radio"
              aria-checked={id === selectedThemeId}
              aria-label={theme.name}
              data-theme-id={id}
              tabIndex={id === selectedThemeId ? 0 : -1}
              onClick={() => {
                onSelect(id as Settings['themeId']);
              }}
            >
              <BoardPreview theme={theme} size={80} />
              <span className={styles.themeLabel}>{theme.name}</span>
            </button>
          );
        })}
      </div>

      {/*
        P6.3 (Phase A) — the Margin Notes escalation toggle is retired.
        Escalation is permanent for Margin Notes after the P6.1 default
        flip; no user-visible toggle remains. The settings field is kept
        for ~30 days post-release per the parent plan §10 rollback plan;
        it can be removed entirely in a follow-on P6.3-cleanup task.
      */}
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
    speed <= 0.6
      ? 'Fast'
      : speed <= 0.8
        ? 'Slightly fast'
        : speed <= 1.2
          ? 'Normal'
          : speed <= 1.6
            ? 'Slightly slow'
            : 'Slow';

  return (
    <section className={styles.section} aria-labelledby="anim-speed-heading">
      <h2 id="anim-speed-heading" className={styles.sectionTitle}>
        Animation Speed
      </h2>
      <div className={styles.sliderRow}>
        <span className={styles.sliderLabel} aria-hidden="true">
          Slow
        </span>
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
        <span className={styles.sliderLabel} aria-hidden="true">Fast</span>
      </div>
      <p className={styles.sliderHint} aria-live="polite">{speedLabel}</p>
    </section>
  );
}

function VolumeSlider({
  id,
  label,
  value,
  onChange,
  disabled,
  audioManager,
  playPreview,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  audioManager: AudioManager | null;
  playPreview: boolean;
}) {
  const percent = Math.round(value * 100);

  return (
    <div className={styles.volumeRow}>
      <label htmlFor={id} className={styles.volumeLabel}>
        {label}
      </label>
      <input
        id={id}
        type="range"
        min="0"
        max="100"
        step="1"
        value={percent}
        onChange={(e) => {
          onChange(parseInt(e.target.value, 10) / 100);
        }}
        onPointerUp={() => {
          if (playPreview && !disabled) {
            audioManager?.play(SoundEvent.MenuClick);
          }
        }}
        onTouchEnd={() => {
          if (playPreview && !disabled) {
            audioManager?.play(SoundEvent.MenuClick);
          }
        }}
        className={styles.slider}
        aria-label={label}
        aria-valuetext={String(percent) + '%'}
        disabled={disabled}
      />
      <span className={styles.volumeValue} aria-hidden="true">
        {percent}%
      </span>
    </div>
  );
}

function SoundSection({
  settings,
  onChange,
  audioManager,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
  audioManager: AudioManager | null;
}) {
  return (
    <section className={styles.section} aria-labelledby="sound-heading">
      <h2 id="sound-heading" className={styles.sectionTitle}>
        Sound
      </h2>

      <div className={styles.toggleRow}>
        <label htmlFor="mute-toggle" className={styles.toggleLabel}>
          Mute all audio
        </label>
        <button
          id="mute-toggle"
          role="switch"
          aria-checked={settings.muted}
          className={[styles.toggleSwitch, settings.muted ? styles.toggleOn : '']
            .filter(Boolean)
            .join(' ')}
          onClick={() => {
            onChange({ ...settings, muted: !settings.muted });
          }}
          data-testid="sound-toggle"
        >
          <span className={styles.toggleKnob} />
        </button>
      </div>

      <div className={styles.volumeSliders} data-muted={settings.muted}>
        <VolumeSlider
          id="master-volume"
          label="Master Volume"
          value={settings.masterVolume}
          onChange={(v) => {
            onChange({ ...settings, masterVolume: v });
          }}
          disabled={settings.muted}
          audioManager={audioManager}
          playPreview={true}
        />
        <VolumeSlider
          id="sfx-volume"
          label="SFX Volume"
          value={settings.sfxVolume}
          onChange={(v) => {
            onChange({ ...settings, sfxVolume: v });
          }}
          disabled={settings.muted}
          audioManager={audioManager}
          playPreview={true}
        />
        <VolumeSlider
          id="music-volume"
          label="Music Volume"
          value={settings.musicVolume}
          onChange={(v) => {
            onChange({ ...settings, musicVolume: v });
          }}
          disabled={settings.muted}
          audioManager={audioManager}
          playPreview={false}
        />
      </div>

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
          className={[styles.toggleSwitch, enabled ? styles.toggleOn : '']
            .filter(Boolean)
            .join(' ')}
          onClick={() => {
            onChange(!enabled);
          }}
        >
          <span className={styles.toggleKnob} />
        </button>
      </div>
      <p className={styles.settingHint}>
        When enabled, selecting a destination highlights it and requires a second click to confirm.
        Press Escape or click elsewhere to cancel.
      </p>
    </section>
  );
}

function formatTimestampForFilename(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    String(d.getFullYear()) +
    '-' + pad(d.getMonth() + 1) +
    '-' + pad(d.getDate()) +
    '-' + pad(d.getHours()) +
    pad(d.getMinutes())
  );
}

function DataSection() {
  const [status, setStatus] = useState<{
    kind: 'info' | 'error';
    text: string;
  } | null>(null);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport(): Promise<void> {
    try {
      const envelope = await exportAll();
      const blob = new Blob([serializeExportEnvelope(envelope)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crazy-checkers-export-${formatTimestampForFilename(envelope.exportedAt)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus({ kind: 'info', text: 'Exported.' });
    } catch (err) {
      console.warn('[Configure] export failed', err);
      setStatus({ kind: 'error', text: 'Export failed — see browser console.' });
    }
  }

  function handleImportClick(): void {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = e.target.files?.[0];
    // Reset the input so re-selecting the same file triggers onChange again.
    e.target.value = '';
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setStatus({ kind: 'error', text: 'Could not read file.' });
      return;
    }
    setPendingImport(text);
  }

  async function handleConfirmImport(): Promise<void> {
    if (pendingImport === null) return;
    const parsed = parseExportEnvelope(pendingImport);
    setPendingImport(null);
    if (parsed.kind === 'invalid-envelope') {
      setStatus({ kind: 'error', text: `Import failed: ${parsed.reason}` });
      return;
    }
    if (parsed.kind === 'unsupported-version') {
      setStatus({
        kind: 'error',
        text: `This file is from a newer version of Crazy Checkers (schema v${String(parsed.actualVersion)}). Please update the app.`,
      });
      return;
    }
    setIsBusy(true);
    const result = await importAll(parsed.envelope);
    setIsBusy(false);
    if (result.kind !== 'ok') {
      setStatus({
        kind: 'error',
        text: `Import failed while writing ${result.slot}. Storage may be full or unavailable.`,
      });
      return;
    }
    setStatus({ kind: 'info', text: 'Imported. Reloading…' });
    // Let the success message paint briefly before reload.
    setTimeout(() => { window.location.reload(); }, 300);
  }

  async function handleResetConfirm(): Promise<void> {
    setShowResetDialog(false);
    setIsBusy(true);
    try {
      await resetAll();
    } finally {
      setIsBusy(false);
    }
    setStatus({ kind: 'info', text: 'Progress reset. Reloading…' });
    setTimeout(() => { window.location.reload(); }, 300);
  }

  return (
    <section className={styles.section} aria-labelledby="data-heading">
      <h2 id="data-heading" className={styles.sectionTitle}>
        Data
      </h2>
      <div className={styles.dataButtons}>
        <button
          type="button"
          className={styles.dataButton}
          onClick={() => { void handleExport(); }}
          disabled={isBusy}
          data-testid="config-export-data"
        >
          Export Data
        </button>
        <button
          type="button"
          className={styles.dataButton}
          onClick={handleImportClick}
          disabled={isBusy}
          data-testid="config-import-data"
        >
          Import Data
        </button>
        <button
          type="button"
          className={[styles.dataButton, styles.dangerButton].filter(Boolean).join(' ')}
          onClick={() => { setShowResetDialog(true); }}
          disabled={isBusy}
          data-testid="config-reset-progress"
        >
          Reset Progress
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => { void handleFileSelected(e); }}
        data-testid="config-import-file-input"
      />
      <p
        className={styles.settingHint}
        aria-live="polite"
        data-testid="config-data-status"
        style={
          status?.kind === 'error'
            ? { color: 'var(--ui-error)', opacity: 1 }
            : undefined
        }
      >
        {status?.text ??
          'Export creates a backup of all your settings, games, and unlocks. Import replaces them. Reset erases everything.'}
      </p>

      {pendingImport !== null && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="import-confirm-title"
          data-testid="config-import-confirm"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: 'var(--ui-surface)',
              color: 'var(--ui-text)',
              border: '1px solid var(--ui-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              maxWidth: '28rem',
              width: '90%',
            }}
          >
            <h3 id="import-confirm-title" style={{ margin: '0 0 0.5rem', color: 'var(--ui-accent)' }}>
              Replace current data?
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', lineHeight: 1.4 }}>
              Importing will overwrite settings, completed game history,
              challenge progress, and unlocks on this device with the
              contents of the selected file. This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => { setPendingImport(null); }}
                data-testid="config-import-cancel"
                style={{
                  padding: '0.5rem 1rem',
                  background: 'transparent',
                  border: '1px solid var(--ui-border)',
                  color: 'var(--ui-text)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void handleConfirmImport(); }}
                data-testid="config-import-confirm-btn"
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--ui-accent)',
                  color: 'var(--ui-accent-contrast, var(--ui-bg))',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetDialog && (
        <ResetProgressDialog
          onConfirm={() => { void handleResetConfirm(); }}
          onCancel={() => { setShowResetDialog(false); }}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// ConfigScreen
// ---------------------------------------------------------------------------

export default function ConfigScreen({ settings, onSettingsChange, onBack }: ConfigScreenProps) {
  const audioManager = useAudioManager();

  const setTheme = (themeId: Settings['themeId']) => {
    // P4.1 — When moving TO margin-notes for the first time and the user
    // hasn't explicitly toggled escalation off, auto-derive the flag to
    // true. Switching AWAY from margin-notes preserves the existing flag.
    onSettingsChange(coerceEscalationOnThemeChange(settings, themeId));
  };

  const setAnimationSpeed = (speed: number) => {
    onSettingsChange({ ...settings, animationSpeed: speed });
  };

  const setMoveConfirmation = (enabled: boolean) => {
    onSettingsChange({ ...settings, moveConfirmation: enabled });
  };

  return (
    <ModeScreenShell title="Configure" onBack={onBack} testId="config-screen">
      <ThemeSection
        selectedThemeId={settings.themeId}
        onSelect={setTheme}
      />

      <AnimationSpeedSection speed={settings.animationSpeed} onChange={setAnimationSpeed} />

      <SoundSection settings={settings} onChange={onSettingsChange} audioManager={audioManager} />

      <div className={styles.section}>
        <TimeControlSection
          value={settings.timeControl}
          onChange={(tc) => { onSettingsChange({ ...settings, timeControl: tc }); }}
        />
      </div>

      <MoveConfirmationSection
        enabled={settings.moveConfirmation}
        onChange={setMoveConfirmation}
      />

      <DataSection />
    </ModeScreenShell>
  );
}
