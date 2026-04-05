/**
 * Time Control settings section.
 *
 * Renders a preset selector (pill-style radio group) and, when "Custom"
 * is selected, manual configuration fields for the chosen mode.
 * Reused in both ConfigScreen and TimeControlOverride (GameSetupDialog).
 */

import { useState, useRef } from 'react';
import type { TimeControlConfig, TimeControlMode } from '../engine/clock';
import {
  TIME_CONTROL_PRESETS,
  MODE_OPTIONS,
  findMatchingPresetId,
  describeConfig,
} from './timeControlPresets';
import styles from './TimeControlSection.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TimeControlSectionProps {
  value: TimeControlConfig | null;
  onChange: (config: TimeControlConfig | null) => void;
  headingLevel?: 'h2' | 'h3';
  idPrefix?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TimeControlSection({
  value,
  onChange,
  headingLevel = 'h2',
  idPrefix = 'tc',
}: TimeControlSectionProps) {
  // Track whether the user explicitly selected "Custom" — needed because a
  // custom config might happen to match a preset's values, which would hide
  // the custom fields without this flag.
  const [forceCustom, setForceCustom] = useState(false);

  const presetId = forceCustom ? 'custom' : findMatchingPresetId(value);
  const isCustom = presetId === 'custom';

  // Custom field state — initialised from value (if custom) or Blitz defaults
  const [customMode, setCustomMode] = useState(
    value && isCustom ? value.mode : ('increment' as TimeControlMode),
  );
  const [totalTimeMin, setTotalTimeMin] = useState(
    value && isCustom && value.totalTimeMs ? value.totalTimeMs / 60_000 : 3,
  );
  const [perMoveSec, setPerMoveSec] = useState(
    value && isCustom && value.perMoveTimeMs ? value.perMoveTimeMs / 1_000 : 30,
  );
  const [incrementSec, setIncrementSec] = useState(
    value && isCustom && value.incrementMs ? value.incrementMs / 1_000 : 2,
  );
  const [delaySec, setDelaySec] = useState(
    value && isCustom && value.delayMs ? value.delayMs / 1_000 : 5,
  );

  const groupRef = useRef<HTMLDivElement>(null);

  // Build a config from the custom fields
  function buildCustomConfig(
    mode: TimeControlMode,
    total: number,
    perMove: number,
    inc: number,
    del: number,
  ): TimeControlConfig | null {
    switch (mode) {
      case 'perMove':
        if (perMove < 5) return null;
        return { mode, perMoveTimeMs: perMove * 1_000 };
      case 'suddenDeath':
        if (total < 1) return null;
        return { mode, totalTimeMs: total * 60_000 };
      case 'increment':
        if (total < 1) return null;
        return { mode, totalTimeMs: total * 60_000, incrementMs: Math.max(0, inc) * 1_000 };
      case 'delay':
        if (total < 1) return null;
        return { mode, totalTimeMs: total * 60_000, delayMs: Math.max(0, del) * 1_000 };
    }
  }

  function emitCustomConfig(
    mode: TimeControlMode,
    total: number,
    perMove: number,
    inc: number,
    del: number,
  ) {
    const config = buildCustomConfig(mode, total, perMove, inc, del);
    if (config) onChange(config);
  }

  function handlePresetSelect(id: string) {
    if (id === 'custom') {
      setForceCustom(true);
      // Initialize custom from current value if it's non-null
      if (value) {
        setCustomMode(value.mode);
        if (value.totalTimeMs) setTotalTimeMin(value.totalTimeMs / 60_000);
        if (value.perMoveTimeMs) setPerMoveSec(value.perMoveTimeMs / 1_000);
        if (value.incrementMs !== undefined) setIncrementSec(value.incrementMs / 1_000);
        if (value.delayMs !== undefined) setDelaySec(value.delayMs / 1_000);
      } else {
        // Default to Blitz when switching to custom from untimed
        const blitzConfig: TimeControlConfig = { mode: 'increment', totalTimeMs: 180_000, incrementMs: 2_000 };
        setCustomMode('increment');
        setTotalTimeMin(3);
        setIncrementSec(2);
        onChange(blitzConfig);
      }
      return;
    }

    setForceCustom(false);
    const preset = TIME_CONTROL_PRESETS.find((p) => p.id === id);
    if (preset) onChange(preset.config);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const pills = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    if (!pills) return;
    const currentIndex = Array.from(pills).findIndex((p) => p === document.activeElement);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % pills.length;
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + pills.length) % pills.length;
      e.preventDefault();
    }

    if (nextIndex !== currentIndex) {
      const pill = pills[nextIndex];
      if (pill) {
        pill.focus();
        const id = pill.dataset.presetId;
        if (id) handlePresetSelect(id);
      }
    }
  }

  function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }

  const Heading = headingLevel;

  return (
    <section className="section" aria-labelledby={`${idPrefix}-heading`}>
      <Heading id={`${idPrefix}-heading`} className="sectionTitle" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--ui-accent)', margin: '0 0 1rem 0' }}>
        Time Controls
      </Heading>

      {/* Preset radio group */}
      <div
        ref={groupRef}
        className={styles.presetGroup}
        role="radiogroup"
        aria-label="Time control preset"
        onKeyDown={handleKeyDown}
      >
        {TIME_CONTROL_PRESETS.map((preset) => {
          const selected =
            preset.id === 'custom' ? isCustom : presetId === preset.id;
          return (
            <button
              key={preset.id}
              className={styles.presetPill}
              role="radio"
              aria-checked={selected}
              aria-label={`${preset.label}: ${preset.description}`}
              data-preset-id={preset.id}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                handlePresetSelect(preset.id);
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Custom fields */}
      {isCustom && (
        <div className={styles.customFields}>
          <select
            className={styles.modeSelect}
            value={customMode}
            aria-label="Time control mode"
            onChange={(e) => {
              const mode = e.target.value as TimeControlMode;
              setCustomMode(mode);
              emitCustomConfig(mode, totalTimeMin, perMoveSec, incrementSec, delaySec);
            }}
          >
            {MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {customMode === 'perMove' && (
            <>
              <label htmlFor={`${idPrefix}-per-move`} className={styles.fieldLabel}>
                Per-move time
              </label>
              <input
                id={`${idPrefix}-per-move`}
                type="number"
                className={styles.fieldInput}
                min={5}
                max={300}
                step={5}
                value={perMoveSec}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) {
                    setPerMoveSec(v);
                    emitCustomConfig(customMode, totalTimeMin, v, incrementSec, delaySec);
                  }
                }}
                onBlur={() => {
                  const clamped = clamp(perMoveSec, 5, 300);
                  setPerMoveSec(clamped);
                  emitCustomConfig(customMode, totalTimeMin, clamped, incrementSec, delaySec);
                }}
              />
              <span className={styles.fieldUnit}>sec</span>
            </>
          )}

          {(customMode === 'suddenDeath' || customMode === 'increment' || customMode === 'delay') && (
            <>
              <label htmlFor={`${idPrefix}-total-time`} className={styles.fieldLabel}>
                Total time
              </label>
              <input
                id={`${idPrefix}-total-time`}
                type="number"
                className={styles.fieldInput}
                min={1}
                max={180}
                step={1}
                value={totalTimeMin}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) {
                    setTotalTimeMin(v);
                    emitCustomConfig(customMode, v, perMoveSec, incrementSec, delaySec);
                  }
                }}
                onBlur={() => {
                  const clamped = clamp(totalTimeMin, 1, 180);
                  setTotalTimeMin(clamped);
                  emitCustomConfig(customMode, clamped, perMoveSec, incrementSec, delaySec);
                }}
              />
              <span className={styles.fieldUnit}>min</span>
            </>
          )}

          {customMode === 'increment' && (
            <>
              <label htmlFor={`${idPrefix}-increment`} className={styles.fieldLabel}>
                Increment
              </label>
              <input
                id={`${idPrefix}-increment`}
                type="number"
                className={styles.fieldInput}
                min={0}
                max={60}
                step={1}
                value={incrementSec}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) {
                    setIncrementSec(v);
                    emitCustomConfig(customMode, totalTimeMin, perMoveSec, v, delaySec);
                  }
                }}
                onBlur={() => {
                  const clamped = clamp(incrementSec, 0, 60);
                  setIncrementSec(clamped);
                  emitCustomConfig(customMode, totalTimeMin, perMoveSec, clamped, delaySec);
                }}
              />
              <span className={styles.fieldUnit}>sec</span>
            </>
          )}

          {customMode === 'delay' && (
            <>
              <label htmlFor={`${idPrefix}-delay`} className={styles.fieldLabel}>
                Delay
              </label>
              <input
                id={`${idPrefix}-delay`}
                type="number"
                className={styles.fieldInput}
                min={0}
                max={60}
                step={1}
                value={delaySec}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) {
                    setDelaySec(v);
                    emitCustomConfig(customMode, totalTimeMin, perMoveSec, incrementSec, v);
                  }
                }}
                onBlur={() => {
                  const clamped = clamp(delaySec, 0, 60);
                  setDelaySec(clamped);
                  emitCustomConfig(customMode, totalTimeMin, perMoveSec, incrementSec, clamped);
                }}
              />
              <span className={styles.fieldUnit}>sec</span>
            </>
          )}
        </div>
      )}

      {/* Summary line */}
      <p className={styles.summary} aria-live="polite">
        {describeConfig(value)}
      </p>
    </section>
  );
}
