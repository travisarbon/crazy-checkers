/**
 * Audio system types for the hot-swappable audio pack architecture.
 * See Design Document S2.10, S6.3.
 */

/** All sound effect events that can be triggered during gameplay or UI interaction. */
export const SoundEvent = {
  /** A piece is moved to an empty square. */
  Move: 'move',
  /** A piece captures one or more opponent pieces (single jump, multi-jump). */
  Capture: 'capture',
  /** A piece is selected by the player. */
  Select: 'select',
  /** A pawn is promoted to a king. */
  Promotion: 'promotion',
  /** A Crazy/Chaos event is triggered (any event activation). */
  EventTrigger: 'eventTrigger',
  /** Game ends with a loss for the current player. */
  GameOverLose: 'gameOverLose',
  /** Game ends with a win for the current player. */
  GameOverWin: 'gameOverWin',
  /** Game ends in a draw. */
  GameOverDraw: 'gameOverDraw',
  /** A menu button or UI control is clicked. */
  MenuClick: 'menuClick',
} as const;

export type SoundEvent = (typeof SoundEvent)[keyof typeof SoundEvent];

/**
 * All music track identifiers. Each maps to a specific audio file.
 * Music tracks are assigned to screens and game modes via musicMapping.ts.
 */
export const MusicTrack = {
  ProjectTethys: 'project-tethys',
  PuzzleBattle: 'puzzle-battle',
  Electrofest: 'electrofest',
  SpaceDance: 'space-dance',
  BitLord: 'bit-lord',
  MidnightWalk: 'midnight-walk',
  ModernFuturistic: 'modern-futuristic',
} as const;

export type MusicTrack = (typeof MusicTrack)[keyof typeof MusicTrack];

/**
 * A single audio asset reference with optional per-asset volume adjustment.
 * The url is relative to the public root (e.g., '/audio/sfx/move.mp3').
 */
export interface AudioAsset {
  readonly url: string;
  /** Per-asset volume multiplier, 0.0-1.0. Defaults to 1.0. */
  readonly volume?: number;
}

/**
 * An audio pack bundles all sound effects and music tracks.
 * Packs are hot-swappable at runtime. Missing entries are treated as silent.
 * The SilentPack has all entries absent.
 */
export interface AudioPack {
  readonly id: string;
  readonly name: string;
  /** SFX mapping. Missing entries are silently skipped. */
  readonly sounds: Partial<Record<SoundEvent, AudioAsset>>;
  /** Music track mapping. Missing entries mean no music for that track. */
  readonly music: Partial<Record<MusicTrack, AudioAsset>>;
}

/**
 * Volume settings for the audio system.
 * All values are 0.0-1.0 (linear scale).
 */
export interface AudioSettings {
  readonly masterVolume: number;
  readonly sfxVolume: number;
  readonly musicVolume: number;
  readonly muted: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 0.7,
  sfxVolume: 1.0,
  musicVolume: 0.5,
  muted: false,
};
