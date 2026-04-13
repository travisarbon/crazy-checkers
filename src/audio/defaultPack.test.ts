import { describe, it, expect } from 'vitest';
import { DEFAULT_PACK } from './defaultPack';
import { SoundEvent, MusicTrack } from './types';

describe('DEFAULT_PACK completeness', () => {
  it('has an entry for every SoundEvent', () => {
    for (const [name, event] of Object.entries(SoundEvent)) {
      const asset = DEFAULT_PACK.sounds[event];
      expect(asset, `missing sound for ${name}`).toBeDefined();
      expect(asset?.url).toBeTruthy();
    }
  });

  it('has an entry for every MusicTrack', () => {
    for (const [name, track] of Object.entries(MusicTrack)) {
      const asset = DEFAULT_PACK.music[track];
      expect(asset, `missing music for ${name}`).toBeDefined();
      expect(asset?.url).toBeTruthy();
    }
  });

  it('all SFX URLs follow naming convention', () => {
    for (const asset of Object.values(DEFAULT_PACK.sounds)) {
      expect(asset.url).toMatch(/\/audio\/sfx\/[\w-]+\.mp3$/);
    }
  });

  it('all music URLs follow naming convention', () => {
    for (const asset of Object.values(DEFAULT_PACK.music)) {
      expect(asset.url).toMatch(/\/audio\/music\/[\w-]+\.mp3$/);
    }
  });

  it('all volume values are in the (0, 1] range', () => {
    for (const asset of Object.values(DEFAULT_PACK.sounds)) {
      if (asset.volume !== undefined) {
        expect(asset.volume).toBeGreaterThan(0);
        expect(asset.volume).toBeLessThanOrEqual(1);
      }
    }
  });
});
