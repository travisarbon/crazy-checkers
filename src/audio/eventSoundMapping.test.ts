import { describe, it, expect } from 'vitest';
import { CrazyEvent } from '../engine/types';
import { EVENT_SOUND_MAP, getEventSound } from './eventSoundMapping';

describe('eventSoundMapping', () => {
  it('has an entry for every CrazyEvent', () => {
    for (const [name, event] of Object.entries(CrazyEvent)) {
      expect(EVENT_SOUND_MAP[event], `missing mapping for ${name}`).toBeDefined();
    }
  });

  it('getEventSound returns the same entry as the map', () => {
    for (const event of Object.values(CrazyEvent)) {
      const viaFn = getEventSound(event);
      const viaMap = EVENT_SOUND_MAP[event];
      expect(viaFn).toEqual(viaMap ?? null);
    }
  });

  it('all referenced URLs point at audio/sfx/events/*.mp3', () => {
    for (const sound of Object.values(EVENT_SOUND_MAP)) {
      expect(sound.url).toMatch(/audio\/sfx\/events\/[\w-]+\.mp3$/);
    }
  });

  it('all volumes are in the (0, 1] range', () => {
    for (const sound of Object.values(EVENT_SOUND_MAP)) {
      expect(sound.volume).toBeGreaterThan(0);
      expect(sound.volume).toBeLessThanOrEqual(1);
    }
  });
});
