/**
 * Central audio manager using the Web Audio API.
 *
 * Architecture:
 * - Uses a single AudioContext (created on first user interaction to comply
 *   with browser autoplay policies).
 * - SFX: decoded AudioBuffers played via AudioBufferSourceNode -> GainNode -> destination.
 *   Pre-decoded on pack load for zero-latency playback.
 * - Music: HTMLAudioElement for streaming (avoids decoding entire tracks into memory).
 *   Connected to AudioContext via MediaElementAudioSourceNode for volume control.
 * - Volume chain: source -> per-channel GainNode (sfx or music) -> master GainNode -> destination.
 * - Hot-swap: loading a new pack stops current music, clears decoded buffers,
 *   and begins preloading the new pack's assets.
 */

import type { AudioPack, AudioSettings, MusicTrack, SoundEvent } from './types';

/** Initialized audio nodes — only non-null after ensureContext() succeeds. */
interface AudioNodes {
  readonly context: AudioContext;
  readonly masterGain: GainNode;
  readonly sfxGain: GainNode;
  readonly musicGain: GainNode;
}

export class AudioManager {
  private nodes: AudioNodes | null = null;

  private pack: AudioPack;
  private settings: AudioSettings;

  /** Pre-decoded SFX buffers for zero-latency playback. */
  private sfxBuffers: Map<string, AudioBuffer> = new Map();

  /** Current music playback state. */
  private musicElement: HTMLAudioElement | null = null;
  private musicSource: MediaElementAudioSourceNode | null = null;
  private currentMusicTrack: MusicTrack | null = null;

  constructor(pack: AudioPack, settings: AudioSettings) {
    this.pack = pack;
    this.settings = settings;
  }

  // -------------------------------------------------------------------------
  // AudioContext initialization
  // -------------------------------------------------------------------------

  /**
   * Lazily initializes the AudioContext on first user interaction.
   * Returns the audio nodes, or null if initialization fails.
   */
  private ensureContext(): AudioNodes | null {
    if (this.nodes) return this.nodes;

    try {
      const context = new AudioContext();

      // Volume chain: source -> channel gain -> master gain -> destination
      const masterGain = context.createGain();
      masterGain.connect(context.destination);

      const sfxGain = context.createGain();
      sfxGain.connect(masterGain);

      const musicGain = context.createGain();
      musicGain.connect(masterGain);

      this.nodes = { context, masterGain, sfxGain, musicGain };
      this.applyVolumes();
      void this.preloadSfx();
      return this.nodes;
    } catch (err) {
      console.warn('AudioManager: Web Audio API not available:', err);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // SFX preloading
  // -------------------------------------------------------------------------

  /**
   * Preloads all SFX from the current pack into decoded AudioBuffers.
   * Runs asynchronously after context initialization.
   */
  private async preloadSfx(): Promise<void> {
    const nodes = this.nodes;
    if (!nodes) return;

    const entries = Object.entries(this.pack.sounds) as [SoundEvent, { url: string; volume?: number }][];

    await Promise.allSettled(
      entries.map(async ([event, asset]) => {
        try {
          const response = await fetch(asset.url);
          if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await nodes.context.decodeAudioData(arrayBuffer);
          this.sfxBuffers.set(event, audioBuffer);
        } catch (err) {
          console.warn(`AudioManager: Failed to preload SFX "${event}":`, err);
        }
      }),
    );
  }

  // -------------------------------------------------------------------------
  // SFX playback
  // -------------------------------------------------------------------------

  /**
   * Plays a one-shot sound effect. No-ops silently if the sound is
   * not in the current pack, if audio is muted, or if initialization fails.
   */
  play(event: SoundEvent): void {
    if (this.settings.muted) return;

    const nodes = this.ensureContext();
    if (!nodes) return;

    const buffer = this.sfxBuffers.get(event);
    if (!buffer) return;

    const source = nodes.context.createBufferSource();
    source.buffer = buffer;

    const asset = this.pack.sounds[event];
    const assetVolume = asset?.volume ?? 1.0;

    const assetGain = nodes.context.createGain();
    assetGain.gain.value = assetVolume;
    source.connect(assetGain);
    assetGain.connect(nodes.sfxGain);

    source.start(0);
  }

  // -------------------------------------------------------------------------
  // Music playback
  // -------------------------------------------------------------------------

  /**
   * Starts playing a music track. If the requested track is already playing,
   * this is a no-op (preserving continuity across screen transitions).
   */
  playMusic(track: MusicTrack): void {
    // Same track already playing -- do nothing (continuity)
    if (this.currentMusicTrack === track && this.musicElement && !this.musicElement.paused) {
      return;
    }

    if (this.settings.muted) {
      this.currentMusicTrack = track;
      return;
    }

    const nodes = this.ensureContext();
    if (!nodes) return;

    const asset = this.pack.music[track];
    if (!asset) return;

    this.stopMusicInternal();

    const audio = new Audio(asset.url);
    audio.loop = true;
    audio.crossOrigin = 'anonymous';

    const source = nodes.context.createMediaElementSource(audio);
    const assetGain = nodes.context.createGain();
    assetGain.gain.value = asset.volume ?? 1.0;
    source.connect(assetGain);
    assetGain.connect(nodes.musicGain);

    this.musicElement = audio;
    this.musicSource = source;
    this.currentMusicTrack = track;

    audio.play().catch((err: unknown) => {
      console.warn('AudioManager: Music playback failed:', err);
    });
  }

  /** Stops the current music track. */
  stopMusic(): void {
    this.stopMusicInternal();
    this.currentMusicTrack = null;
  }

  private stopMusicInternal(): void {
    if (this.musicElement) {
      this.musicElement.pause();
      this.musicElement.src = '';
      this.musicElement = null;
    }
    if (this.musicSource) {
      this.musicSource.disconnect();
      this.musicSource = null;
    }
  }

  // -------------------------------------------------------------------------
  // Volume control
  // -------------------------------------------------------------------------

  /** Updates audio settings (volumes, mute state). Takes effect immediately. */
  updateSettings(settings: AudioSettings): void {
    this.settings = settings;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    const nodes = this.nodes;
    if (!nodes) return;

    const masterVol = this.settings.muted ? 0 : this.settings.masterVolume;
    nodes.masterGain.gain.setValueAtTime(masterVol, nodes.context.currentTime);
    nodes.sfxGain.gain.setValueAtTime(this.settings.sfxVolume, nodes.context.currentTime);
    nodes.musicGain.gain.setValueAtTime(this.settings.musicVolume, nodes.context.currentTime);

    // If muted, pause music element to save resources; resume on unmute
    if (this.settings.muted && this.musicElement && !this.musicElement.paused) {
      this.musicElement.pause();
    } else if (
      !this.settings.muted &&
      this.musicElement &&
      this.musicElement.paused &&
      this.currentMusicTrack
    ) {
      this.musicElement.play().catch(() => {
        /* ignore */
      });
    }
  }

  // -------------------------------------------------------------------------
  // Hot-swap pack loading
  // -------------------------------------------------------------------------

  /** Replaces the current audio pack at runtime. */
  async loadPack(pack: AudioPack): Promise<void> {
    this.stopMusic();
    this.sfxBuffers.clear();
    this.pack = pack;

    if (this.nodes) {
      await this.preloadSfx();
    }
  }

  /** Returns the currently loaded pack's ID. */
  getPackId(): string {
    return this.pack.id;
  }

  /** Returns the track currently playing (or null if music is stopped). */
  getCurrentMusicTrack(): MusicTrack | null {
    return this.currentMusicTrack;
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  /** Disposes the AudioManager, releasing all resources. */
  dispose(): void {
    this.stopMusic();
    this.sfxBuffers.clear();
    if (this.nodes && this.nodes.context.state !== 'closed') {
      this.nodes.context.close().catch(() => {
        /* ignore */
      });
    }
    this.nodes = null;
  }
}
