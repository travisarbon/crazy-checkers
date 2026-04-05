/**
 * Time control presets and helpers — shared between TimeControlSection
 * and TimeControlOverride.
 *
 * Extracted to its own module so TimeControlSection.tsx exports only
 * React components (required by react-refresh/only-export-components).
 */

import type { TimeControlConfig, TimeControlMode } from '../engine/clock';

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface TimeControlPreset {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly config: TimeControlConfig | null; // null for "None"
}

export const TIME_CONTROL_PRESETS: readonly TimeControlPreset[] = [
  {
    id: 'none',
    label: 'None',
    description: 'Untimed',
    config: null,
  },
  {
    id: 'bullet',
    label: 'Bullet',
    description: '1 min + 1s increment',
    config: { mode: 'increment', totalTimeMs: 60_000, incrementMs: 1_000 },
  },
  {
    id: 'blitz',
    label: 'Blitz',
    description: '3 min + 2s increment',
    config: { mode: 'increment', totalTimeMs: 180_000, incrementMs: 2_000 },
  },
  {
    id: 'rapid',
    label: 'Rapid',
    description: '10 min + 5s increment',
    config: { mode: 'increment', totalTimeMs: 600_000, incrementMs: 5_000 },
  },
  {
    id: 'classical',
    label: 'Classical',
    description: '30 min + 10s increment',
    config: { mode: 'increment', totalTimeMs: 1_800_000, incrementMs: 10_000 },
  },
  {
    id: 'per-move-30',
    label: 'Per-move 30s',
    description: '30s per move',
    config: { mode: 'perMove', perMoveTimeMs: 30_000 },
  },
  {
    id: 'per-move-60',
    label: 'Per-move 60s',
    description: '60s per move',
    config: { mode: 'perMove', perMoveTimeMs: 60_000 },
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Configure manually',
    config: null, // placeholder — custom fields determine actual config
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function configMatchesPreset(config: TimeControlConfig | null, preset: TimeControlPreset): boolean {
  if (preset.id === 'custom') return false;
  if (config === null && preset.config === null) return preset.id === 'none';
  if (config === null || preset.config === null) return false;
  return (
    config.mode === preset.config.mode &&
    config.totalTimeMs === preset.config.totalTimeMs &&
    config.perMoveTimeMs === preset.config.perMoveTimeMs &&
    config.incrementMs === preset.config.incrementMs &&
    config.delayMs === preset.config.delayMs
  );
}

export function findMatchingPresetId(config: TimeControlConfig | null): string {
  for (const preset of TIME_CONTROL_PRESETS) {
    if (configMatchesPreset(config, preset)) return preset.id;
  }
  return 'custom';
}

export function describeConfig(config: TimeControlConfig | null): string {
  if (config === null) return 'Untimed';
  switch (config.mode) {
    case 'perMove':
      return String((config.perMoveTimeMs ?? 0) / 1000) + 's per move';
    case 'suddenDeath':
      return String((config.totalTimeMs ?? 0) / 60_000) + ' min sudden death';
    case 'increment':
      return String((config.totalTimeMs ?? 0) / 60_000) + ' min + ' + String((config.incrementMs ?? 0) / 1000) + 's increment';
    case 'delay':
      return String((config.totalTimeMs ?? 0) / 60_000) + ' min with ' + String((config.delayMs ?? 0) / 1000) + 's delay';
  }
}

export const MODE_OPTIONS: { value: TimeControlMode; label: string }[] = [
  { value: 'perMove', label: 'Per-move' },
  { value: 'suddenDeath', label: 'Sudden death' },
  { value: 'increment', label: 'Increment' },
  { value: 'delay', label: 'Delay' },
];
