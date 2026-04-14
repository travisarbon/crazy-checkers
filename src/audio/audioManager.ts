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

  /**
   * Cache for dynamically loaded audio buffers (event-specific sounds
   * that are not part of the standard SoundEvent enum).
   */
  private dynamicBuffers: Map<string, AudioBuffer> = new Map();

  /**
   * Current music playback state.
   *
   * We use a decoded AudioBuffer + AudioBufferSourceNode with `loop = true`
   * rather than an HTMLAudioElement, because HTMLAudioElement has a known
   * ~100–400ms loop gap in Safari/Chrome. AudioBuffer looping is
   * sample-accurate and gapless.
   */
  private musicSourceNode: AudioBufferSourceNode | null = null;
  private musicGainNode: GainNode | null = null;
  private musicBuffers: Map<MusicTrack, AudioBuffer> = new Map();
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

  /**
   * Plays a one-shot sound effect from an arbitrary URL. Fetches and decodes
   * the asset on first call; subsequent calls reuse the cached buffer.
   *
   * Used for event-specific sounds that live outside the pack's SoundEvent
   * mapping (see src/audio/eventSoundMapping.ts). Errors are swallowed so a
   * missing file never interrupts gameplay.
   */
  async playUrl(url: string, volume = 1.0): Promise<void> {
    if (this.settings.muted) return;

    const nodes = this.ensureContext();
    if (!nodes) return;

    this.startPendingMusic(nodes);

    let buffer = this.dynamicBuffers.get(url);
    if (!buffer) {
      try {
        const response = await fetch(url);
        if (!response.ok) return;
        const arrayBuffer = await response.arrayBuffer();
        buffer = await nodes.context.decodeAudioData(arrayBuffer);
        this.dynamicBuffers.set(url, buffer);
      } catch {
        return;
      }
    }

    const source = nodes.context.createBufferSource();
    source.buffer = buffer;

    const assetGain = nodes.context.createGain();
    assetGain.gain.value = volume;
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
    if (this.currentMusicTrack === track && this.musicSourceNode) {
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

  /**
   * Fetches and decodes a music asset into an AudioBuffer, caching it for reuse.
   * Returns null on failure (missing file, network error, decode error).
   */
  private async loadMusicBuffer(
    track: MusicTrack,
    nodes: AudioNodes,
  ): Promise<AudioBuffer | null> {
    const cached = this.musicBuffers.get(track);
    if (cached) return cached;

    const asset = this.pack.music[track];
    if (!asset) return null;

    try {
      const response = await fetch(asset.url);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await nodes.context.decodeAudioData(arrayBuffer);
      this.musicBuffers.set(track, buffer);
      return buffer;
    } catch (err) {
      console.warn(`AudioManager: Failed to load music track "${track}":`, err);
      return null;
    }
  }

  /**
   * Starts a music track via AudioBufferSourceNode with seamless looping.
   * If the buffer is not yet decoded, decode asynchronously then start.
   */
  private startMusicTrack(track: MusicTrack, nodes: AudioNodes): void {
    const asset = this.pack.music[track];
    if (!asset) return;

    this.stopMusicInternal();
    this.currentMusicTrack = track;

    void (async () => {
      const buffer = await this.loadMusicBuffer(track, nodes);
      if (!buffer) return;
      // Abort if the user requested a different track while we were decoding.
      if (this.currentMusicTrack !== track) return;

      const source = nodes.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gain = nodes.context.createGain();
      gain.gain.value = asset.volume ?? 1.0;

      source.connect(gain);
      gain.connect(nodes.musicGain);

      this.musicSourceNode = source;
      this.musicGainNode = gain;

      source.start(0);
    })();
  }

  /** Stops the current music track. */
  stopMusic(): void {
    this.stopMusicInternal();
    this.currentMusicTrack = null;
    this.pendingMusicTrack = null;
  }

  private stopMusicInternal(): void {
    if (this.musicSourceNode) {
      try { this.musicSourceNode.stop(0); } catch { /* already stopped */ }
      this.musicSourceNode.disconnect();
      this.musicSourceNode = null;
    }
    if (this.musicGainNode) {
      this.musicGainNode.disconnect();
      this.musicGainNode = null;
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

    // If muted, stop the source to save resources.
    if (this.settings.muted) {
      this.stopMusicInternal();
    } else if (this.currentMusicTrack && !this.musicSourceNode && nodes.context.state === 'running') {
      // Unmuted and no source running — (re)start the desired track.
      this.startMusicTrack(this.currentMusicTrack, nodes);
    }
  }

  // -------------------------------------------------------------------------
  // Hot-swap pack loading
  // -------------------------------------------------------------------------

  /** Replaces the current audio pack at runtime. */
  async loadPack(pack: AudioPack): Promise<void> {
    this.stopMusic();
    this.sfxBuffers.clear();
    this.dynamicBuffers.clear();
    this.musicBuffers.clear();
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
    this.dynamicBuffers.clear();
    this.musicBuffers.clear();
    if (this.nodes && this.nodes.context.state !== 'closed') {
      this.nodes.context.close().catch(() => {
        /* ignore */
      });
    }
    this.nodes = null;
  }
}
