/**
 * User-configurable settings type and defaults.
 * Mirrors the PersistedSettings schema from Design Document §4.6.
 * Task 4.3 will add localStorage serialization for this type.
 */

import { DEFAULT_THEME_ID } from '../themes/theme';
import type { TimeControlConfig } from '../engine/clock';

export interface Settings {
  readonly themeId: 'crazy' | 'cork' | 'current' | 'classic' | 'contrast';
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

  /** Default time control for new games. null = untimed. */
  readonly timeControl: TimeControlConfig | null;
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

  // Time control default
  timeControl: null,
};
