import type { AudioPack, AudioAsset } from './types';
import { SoundEvent, MusicTrack } from './types';

// ---------------------------------------------------------------------------
// Base URL (respects Vite's `base` config for correct asset paths)
// ---------------------------------------------------------------------------

const BASE = import.meta.env.BASE_URL;

// ---------------------------------------------------------------------------
// SFX assets
// ---------------------------------------------------------------------------

const sfx = (filename: string, volume = 1.0): AudioAsset => ({
  url: `${BASE}audio/sfx/${filename}`,
  volume,
});

// ---------------------------------------------------------------------------
// Music assets
// ---------------------------------------------------------------------------

const music = (filename: string, volume = 1.0): AudioAsset => ({
  url: `${BASE}audio/music/${filename}`,
  volume,
});

/**
 * The default audio pack shipping with Crazy Checkers.
 * All SFX and music tracks are included.
 */
export const DEFAULT_PACK: AudioPack = {
  id: 'default',
  name: 'Crazy Checkers',

  sounds: {
    [SoundEvent.Move]: sfx('move.mp3'),
    [SoundEvent.Capture]: sfx('capture.mp3'),
    [SoundEvent.Select]: sfx('select.mp3'),
    [SoundEvent.Promotion]: sfx('promotion.mp3'),
    [SoundEvent.EventTrigger]: sfx('event-trigger.mp3'),
    [SoundEvent.GameOverLose]: sfx('game-over-lose.mp3'),
    [SoundEvent.GameOverWin]: sfx('game-over-win.mp3'),
    [SoundEvent.GameOverDraw]: sfx('game-over-draw.mp3'),
    [SoundEvent.MenuClick]: sfx('menu-click.mp3'),
    [SoundEvent.LowTimeWarning]: sfx('low-time-warning.mp3', 0.8),
    [SoundEvent.UnlockChime]: sfx('unlock-chime.mp3'),
    [SoundEvent.ErrorBuzz]: sfx('error-buzz.mp3', 0.6),
    [SoundEvent.MultiJump]: sfx('multi-jump.mp3', 0.9),
    [SoundEvent.PuzzleSuccess]: sfx('puzzle-success.mp3'),
    [SoundEvent.PuzzleFail]: sfx('puzzle-fail.mp3', 0.7),
    [SoundEvent.EventActivation]: sfx('event-trigger.mp3'),
  },

  music: {
    [MusicTrack.ProjectTethys]: music('project-tethys.mp3'),
    [MusicTrack.PuzzleBattle]: music('puzzle-battle.mp3'),
    [MusicTrack.Electrofest]: music('electrofest.mp3'),
    [MusicTrack.SpaceDance]: music('space-dance.mp3'),
    [MusicTrack.BitLord]: music('bit-lord.mp3'),
    [MusicTrack.MidnightWalk]: music('midnight-walk.mp3'),
    [MusicTrack.ModernFuturistic]: music('modern-futuristic.mp3'),
  },
};
