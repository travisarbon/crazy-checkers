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

  /**
   * Desired music track set before the AudioContext exists.
   * Started once the context is created during a user gesture.
   */
  private pendingMusicTrack: MusicTrack | null = null;

  constructor(pack: AudioPack, settings: AudioSettings) {
    this.pack = pack;
    this.settings = settings;
  }

  // -------------------------------------------------------------------------
  // AudioContext initialization
  // -------------------------------------------------------------------------

  /**
   * Lazily initializes the AudioContext on first call.
   * Should only be called from user-gesture-driven code paths (play())
   * so the browser allows the context to start in 'running' state.
   */
  private ensureContext(): AudioNodes | null {
    if (this.nodes) {
      // Safety net: resume if browser suspended the context (e.g. tab backgrounded)
      if (this.nodes.context.state === 'suspended') {
        void this.nodes.context.resume();
      }
      return this.nodes;
    }

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
   *
   * This is the primary entry point for user-gesture-driven audio.
   * It creates the AudioContext (if needed) and starts any deferred music.
   */
  play(event: SoundEvent): void {
    if (this.settings.muted) return;

    const nodes = this.ensureContext();
    if (!nodes) return;

    // Start deferred music now that we have a running context
    this.startPendingMusic(nodes);

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
   * Requests a music track. If no AudioContext exists yet (typical on first
   * load, since this is called from a React effect rather than a user gesture),
   * the track is deferred and started when play() creates the context.
   */
  playMusic(track: MusicTrack): void {
    // Same track already playing — preserve continuity
    if (this.currentMusicTrack === track && this.musicElement && !this.musicElement.paused) {
      return;
    }

    // Always record the desired track (for muted/deferred cases)
    this.currentMusicTrack = track;

    if (this.settings.muted) return;

    // No running context yet — defer until a user gesture triggers play()
    if (!this.nodes || this.nodes.context.state === 'suspended') {
      this.pendingMusicTrack = track;
      return;
    }

    this.startMusicTrack(track, this.nodes);
  }

  /** Starts deferred music after the AudioContext becomes available. */
  private startPendingMusic(nodes: AudioNodes): void {
    if (!this.pendingMusicTrack || this.settings.muted) return;
    const track = this.pendingMusicTrack;
    this.pendingMusicTrack = null;
    this.startMusicTrack(track, nodes);
  }

  /** Creates an HTMLAudioElement and routes it through the Web Audio graph. */
  private startMusicTrack(track: MusicTrack, nodes: AudioNodes): void {
    const asset = this.pack.music[track];
    if (!asset) return;

    this.stopMusicInternal();

    // Set crossOrigin before src so the browser makes a CORS-ready request
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.loop = true;
    audio.src = asset.url;

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
    this.pendingMusicTrack = null;
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

    // If muted, pause music element to save resources
    if (this.settings.muted && this.musicElement && !this.musicElement.paused) {
      this.musicElement.pause();
    } else if (!this.settings.muted && this.currentMusicTrack) {
      if (this.musicElement && this.musicElement.paused) {
        // Resume existing paused music element
        this.musicElement.play().catch(() => {
          /* ignore */
        });
      } else if (!this.musicElement && nodes.context.state === 'running') {
        // No element yet (was muted when playMusic was called) — start now
        this.startMusicTrack(this.currentMusicTrack, nodes);
      }
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
