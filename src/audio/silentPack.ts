import type { AudioPack } from './types';

/**
 * A silent audio pack -- all sounds and music are absent.
 * Used as the default when audio assets are unavailable or when
 * the user selects "No Sound" in Configure.
 */
export const SILENT_PACK: AudioPack = {
  id: 'silent',
  name: 'Silent',
  sounds: {},
  music: {},
};
