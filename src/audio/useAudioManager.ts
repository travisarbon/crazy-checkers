import { createContext, useContext } from 'react';
import type { AudioManager } from './audioManager';

/**
 * React context for the AudioManager singleton.
 * Provided at the App root; consumed by any component that needs to
 * play sounds or control music.
 */
export const AudioManagerContext = createContext<AudioManager | null>(null);

/**
 * Hook to access the AudioManager from any component.
 * Returns null if audio is not available (should not happen in practice
 * since App.tsx always provides a manager).
 */
export function useAudioManager(): AudioManager | null {
  return useContext(AudioManagerContext);
}
