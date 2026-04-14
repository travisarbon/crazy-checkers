import { describe, it, expect } from 'vitest';
import { getEventSound } from './eventSoundMapping';

describe('eventSoundMapping', () => {
  it('returns null so the unified EventTrigger sound is used', () => {
    expect(getEventSound()).toBeNull();
  });
});
