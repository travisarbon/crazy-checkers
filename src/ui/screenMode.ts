/**
 * Resolves the body[data-mode] attribute value for a given navigation screen.
 *
 * P1.3 of the Margin Notes UI Redesign. The attribute is written by App.tsx
 * only when settings.marginNotesEscalation is true; nothing reads the
 * attribute today (P4.2 introduces the escalation CSS).
 *
 * The mapping table lives in
 * Documentation/UI Overhaul/P1.3-Add-Data-Mode-Substrate.md §3.
 */

import type { GameMode } from '../engine/types';
import { GameMode as GameModeEnum } from '../engine/types';

/**
 * The five legal data-mode values. Keep this union in lockstep with the
 * escalation CSS that P4.2 will introduce.
 */
export type BodyModeAttribute = 'menu' | 'classic' | 'crazy' | 'choice' | 'chaos';

/**
 * Structural-subset shape we accept from App.tsx so this helper does not
 * pull in every screen-kind variant's payload.
 */
export interface ScreenForMode {
  readonly kind: string;
}

export function resolveModeAttribute(
  screen: ScreenForMode,
  gameMode?: GameMode,
): BodyModeAttribute {
  switch (screen.kind) {
    case 'menu':
    case 'cogitate':
    case 'career':
    case 'code':
    case 'config':
      return 'menu';

    case 'classic':
    case 'challenge':
    case 'challenge-game':
    case 'classified':
    case 'classified-detail':
    case 'classified-game':
      return 'classic';

    case 'crazy':
      return 'crazy';

    case 'choice':
    case 'choice-detail':
      return 'choice';

    case 'chaos':
      return 'chaos';

    case 'game': {
      if (gameMode === undefined) {
        if (import.meta.env.DEV) {
          console.warn(
            "[screenMode] resolveModeAttribute received kind='game' " +
              'without a gameMode argument; defaulting to "classic". ' +
              'Caller should pass screen.mode.',
          );
        }
        return 'classic';
      }
      switch (gameMode) {
        case GameModeEnum.Classic:
          return 'classic';
        case GameModeEnum.Crazy:
          return 'crazy';
        case GameModeEnum.Choice:
          return 'choice';
        case GameModeEnum.Chaos:
          return 'chaos';
        default:
          return 'classic';
      }
    }

    default:
      return 'menu';
  }
}
