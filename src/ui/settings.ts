/**
 * User-configurable settings type and defaults.
 * Mirrors the PersistedSettings schema from Design Document §4.6.
 * Task 4.3 will add localStorage serialization for this type.
 */

import { DEFAULT_THEME_ID } from '../themes/theme';

export interface Settings {
  readonly themeId: 'crazy' | 'cork' | 'current' | 'classic' | 'contrast';
  /**
   * Animation duration multiplier. 1.0 is default.
   * Lower = faster (0.5 = 2× speed), higher = slower (2.0 = half speed).
   */
  readonly animationSpeed: number;
  readonly moveConfirmation: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  themeId: DEFAULT_THEME_ID as Settings['themeId'],
  animationSpeed: 1.0,
  moveConfirmation: false,
};
