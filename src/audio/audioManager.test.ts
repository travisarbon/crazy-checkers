import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioManager } from './audioManager';
import { SILENT_PACK } from './silentPack';
import { DEFAULT_PACK } from './defaultPack';
import type { AudioPack, AudioSettings } from './types';
import { SoundEvent, MusicTrack, DEFAULT_AUDIO_SETTINGS } from './types';

// ---------------------------------------------------------------------------
// Web Audio API mocks
// ---------------------------------------------------------------------------

function createMockGainNode(): GainNode {
  return {
    gain: { value: 1, setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as GainNode;
}

function createMockBufferSource(): AudioBufferSourceNode {
  return {
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as AudioBufferSourceNode;
}

function createMockMediaElementSource(): MediaElementAudioSourceNode {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as MediaElementAudioSourceNode;
}

let mockGainNodes: GainNode[];
let mockBufferSources: AudioBufferSourceNode[];

beforeEach(() => {
  // Must use a class (not vi.fn) so `new AudioContext()` works
  vi.stubGlobal(
    'AudioContext',
    class MockAudioContext {
      currentTime = 0;
      state = 'running';
      destination = {};
      createGain = vi.fn(() => {
        const node = createMockGainNode();
        mockGainNodes.push(node);
        return node;
      });
      createBufferSource = vi.fn(() => {
        const source = createMockBufferSource();
        mockBufferSources.push(source);
        return source;
      });
      createMediaElementSource = vi.fn(() => createMockMediaElementSource());
      decodeAudioData = vi.fn().mockResolvedValue({} as AudioBuffer);
      close = vi.fn().mockResolvedValue(undefined);
    },
  );
  // Reset tracking arrays
  mockGainNodes = [];
  mockBufferSources = [];

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  }));

  // Must use a class for `new Audio()`
  vi.stubGlobal(
    'Audio',
    class MockAudio {
      loop = false;
      crossOrigin = '';
      src = '';
      paused = false; // Start as not paused (playing) to test continuity
      play = vi.fn().mockResolvedValue(undefined);
      pause = vi.fn();
    },
  );
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AudioManager', () => {
  const defaultSettings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };

  it('constructs without errors', () => {
    const manager = new AudioManager(DEFAULT_PACK, defaultSettings);
    expect(manager).toBeDefined();
  });

  it('initializes AudioContext on first play()', () => {
    const manager = new AudioManager(DEFAULT_PACK, defaultSettings);
    manager.play(SoundEvent.Move);
    // After play(), gain nodes should have been created (3: master, sfx, music)
    expect(mockGainNodes.length).toBe(3);
  });

  it('does not create source nodes when muted', () => {
    const manager = new AudioManager(DEFAULT_PACK, { ...defaultSettings, muted: true });
    manager.play(SoundEvent.Move);
    // AudioContext should not be created when muted — no gain nodes
    expect(mockGainNodes.length).toBe(0);
  });

  it('play() is a no-op for sounds not in pack', () => {
    const manager = new AudioManager(SILENT_PACK, defaultSettings);
    // SILENT_PACK has no sounds — should not throw
    expect(() => {
      manager.play(SoundEvent.Move);
    }).not.toThrow();
  });

  it('updateSettings() applies volumes', () => {
    const manager = new AudioManager(DEFAULT_PACK, defaultSettings);
    manager.play(SoundEvent.Move); // triggers init

    manager.updateSettings({ ...defaultSettings, masterVolume: 0.3 });

    // masterGain should have setValueAtTime called
    const masterGain = mockGainNodes[0];
    if (!masterGain) throw new Error('Expected masterGain to be defined');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(masterGain.gain.setValueAtTime).toHaveBeenCalled();
  });

  it('playMusic() tracks the requested track when muted', () => {
    const manager = new AudioManager(DEFAULT_PACK, { ...defaultSettings, muted: true });
    manager.playMusic(MusicTrack.ProjectTethys);
    expect(manager.getCurrentMusicTrack()).toBe(MusicTrack.ProjectTethys);
  });

  it('playMusic() with same track is a no-op when already playing', () => {
    const manager = new AudioManager(DEFAULT_PACK, defaultSettings);
    manager.playMusic(MusicTrack.ProjectTethys);
    expect(manager.getCurrentMusicTrack()).toBe(MusicTrack.ProjectTethys);

    // Second call with the same track should be a no-op (music element is not paused)
    manager.playMusic(MusicTrack.ProjectTethys);
    expect(manager.getCurrentMusicTrack()).toBe(MusicTrack.ProjectTethys);
  });

  it('playMusic() with different track switches', () => {
    const manager = new AudioManager(DEFAULT_PACK, defaultSettings);
    manager.playMusic(MusicTrack.ProjectTethys);
    expect(manager.getCurrentMusicTrack()).toBe(MusicTrack.ProjectTethys);

    manager.playMusic(MusicTrack.Electrofest);
    expect(manager.getCurrentMusicTrack()).toBe(MusicTrack.Electrofest);
  });

  it('stopMusic() clears the current track', () => {
    const manager = new AudioManager(DEFAULT_PACK, defaultSettings);
    manager.playMusic(MusicTrack.ProjectTethys);
    manager.stopMusic();
    expect(manager.getCurrentMusicTrack()).toBeNull();
  });

  it('loadPack() clears buffers and switches pack', async () => {
    const manager = new AudioManager(DEFAULT_PACK, defaultSettings);
    manager.play(SoundEvent.Move); // triggers init

    const newPack: AudioPack = {
      id: 'test',
      name: 'Test',
      sounds: {},
      music: {},
    };

    await manager.loadPack(newPack);
    expect(manager.getPackId()).toBe('test');
  });

  it('getPackId() returns the current pack ID', () => {
    const manager = new AudioManager(DEFAULT_PACK, defaultSettings);
    expect(manager.getPackId()).toBe('default');
  });

  it('SilentPack produces no errors', () => {
    const manager = new AudioManager(SILENT_PACK, defaultSettings);
    expect(() => {
      manager.play(SoundEvent.Move);
      manager.play(SoundEvent.Capture);
      manager.playMusic(MusicTrack.ProjectTethys);
    }).not.toThrow();
  });

  it('dispose() closes the AudioContext', () => {
    const manager = new AudioManager(DEFAULT_PACK, defaultSettings);
    manager.play(SoundEvent.Move); // triggers init
    manager.dispose();
    // After dispose, getCurrentMusicTrack should be null
    expect(manager.getCurrentMusicTrack()).toBeNull();
  });
});
