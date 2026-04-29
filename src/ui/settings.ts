/**
 * User-configurable settings type and defaults.
 * Mirrors the PersistedSettings schema from Design Document §4.6.
 * Task 4.3 will add localStorage serialization for this type.
 */

import { DEFAULT_THEME_ID } from '../themes/theme';
import type { TimeControlConfig } from '../engine/clock';

export interface Settings {
  readonly themeId:
    | 'classic'
    | 'contrast'
    | 'cork'
    | 'crazy-original'
    | 'current'
    | 'margin-notes';
  /**
   * Animation duration multiplier. 1.0 is default.
   * Lower = faster (0.5 = 2× speed), higher = slower (2.0 = half speed).
   */
  readonly animationSpeed: number;
  readonly moveConfirmation: boolean;

  // Audio settings (added in Task 12.1)
  readonly masterVolume: number; // 0.0–1.0
  readonly sfxVolume: number; // 0.0–1.0
  readonly musicVolume: number; // 0.0–1.0
  readonly muted: boolean;
  readonly audioPackId: string; // 'default' | 'silent'

  /**
   * Margin Notes UI redesign — P1.3 substrate flag.
   * When true, App.tsx writes body[data-mode]. When false (the Phase 1–3
   * default), the attribute is not written and the upcoming Margin Notes
   * escalation CSS in P4.2 has no effect. P6.3 retires this flag.
   */
  readonly marginNotesEscalation: boolean;

  /** Default time control for new games. null = untimed. */
  readonly timeControl: TimeControlConfig | null;

  /**
   * P6.4 — Tracks whether the one-time "we refreshed the look" toast
   * has been dismissed. Once true, the toast never shows again.
   */
  readonly marginNotesToastDismissed: boolean;

  /**
   * P6.4 — Timestamp (epoch ms) the toast was first shown to this user.
   * Used to expire the toast after 30 days even if never explicitly
   * dismissed. `null` until the toast is first rendered.
   */
  readonly marginNotesToastFirstSeenAt: number | null;
}

export const DEFAULT_SETTINGS: Settings = {
  themeId: DEFAULT_THEME_ID as Settings['themeId'],
  animationSpeed: 1.0,
  moveConfirmation: false,

  // Audio defaults
  masterVolume: 0.7,
  sfxVolume: 1.0,
  musicVolume: 0.5,
  muted: false,
  audioPackId: 'default',

  // Margin Notes substrate flag — default-on for fresh installs since
  // the new default theme is `margin-notes` (P6.1). The merge logic in
  // src/persistence/settings.ts derives this default from the stored
  // themeId for users without the field; existing users with the field
  // explicitly set keep their choice.
  marginNotesEscalation: true,

  // Time control default
  timeControl: null,

  // P6.4 — toast state defaults (no toast seen yet)
  marginNotesToastDismissed: false,
  marginNotesToastFirstSeenAt: null,
};
