import { MusicTrack } from './types';
import { GameMode } from '../engine/types';

/**
 * Maps non-game screens to their music track.
 * Used by App.tsx to set music when navigating between screens.
 */
export const SCREEN_MUSIC: Record<string, MusicTrack> = {
  menu: MusicTrack.ProjectTethys,
  config: MusicTrack.ProjectTethys,
  career: MusicTrack.ProjectTethys,
  code: MusicTrack.ProjectTethys,
  // Note: `choice`, `choice-detail`, and `cogitate` intentionally omitted.
  // For Choice, music starts when the player launches a game (handled by
  // GAME_MODE_MUSIC on the game screen). For Cogitate, music starts when
  // the player launches a specific tool (see CogitateScreen).
  challenge: MusicTrack.ModernFuturistic,
  'challenge-game': MusicTrack.ModernFuturistic,
  classified: MusicTrack.PuzzleBattle,
  'classified-detail': MusicTrack.PuzzleBattle,
};

/**
 * Maps game modes to their music track.
 * Used by GameScreen to set music when a game begins.
 */
export const GAME_MODE_MUSIC: Record<GameMode, MusicTrack> = {
  [GameMode.Classic]: MusicTrack.PuzzleBattle,
  [GameMode.Crazy]: MusicTrack.Electrofest,
  [GameMode.Choice]: MusicTrack.PuzzleBattle,
  [GameMode.Chaos]: MusicTrack.BitLord,
};

/**
 * Special-case music for modes that don't map cleanly to GameMode.
 */
export const SPECIAL_MODE_MUSIC: Record<string, MusicTrack> = {
  cogitate: MusicTrack.MidnightWalk,
  challenge: MusicTrack.ModernFuturistic,
  extraCrazy: MusicTrack.SpaceDance,
};

/**
 * Resolves the appropriate music track for a given screen/mode context.
 *
 * @param screenKind - The current screen ('menu', 'game', 'config', etc.)
 * @param gameMode - The game mode (only relevant when screenKind is 'game')
 * @param specialMode - Optional special mode identifier (e.g., 'cogitate', 'extraCrazy')
 * @returns The MusicTrack to play, or null if no music should play.
 */
export function resolveMusicTrack(
  screenKind: string,
  gameMode?: GameMode,
  specialMode?: string,
): MusicTrack | null {
  // Special modes take priority
  if (specialMode && specialMode in SPECIAL_MODE_MUSIC) {
    return SPECIAL_MODE_MUSIC[specialMode] as MusicTrack;
  }

  // Game screen: resolve by game mode
  if (screenKind === 'game' && gameMode) {
    return GAME_MODE_MUSIC[gameMode];
  }

  // Non-game screens
  return SCREEN_MUSIC[screenKind] ?? null;
}
