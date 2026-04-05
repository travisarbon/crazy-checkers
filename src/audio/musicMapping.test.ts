import { describe, it, expect } from 'vitest';
import { resolveMusicTrack } from './musicMapping';
import { MusicTrack } from './types';
import { GameMode } from '../engine/types';

describe('resolveMusicTrack', () => {
  it('returns ProjectTethys for menu screen', () => {
    expect(resolveMusicTrack('menu')).toBe(MusicTrack.ProjectTethys);
  });

  it('returns ProjectTethys for config screen', () => {
    expect(resolveMusicTrack('config')).toBe(MusicTrack.ProjectTethys);
  });

  it('returns ProjectTethys for career screen', () => {
    expect(resolveMusicTrack('career')).toBe(MusicTrack.ProjectTethys);
  });

  it('returns ProjectTethys for code screen', () => {
    expect(resolveMusicTrack('code')).toBe(MusicTrack.ProjectTethys);
  });

  it('returns PuzzleBattle for Classic game mode', () => {
    expect(resolveMusicTrack('game', GameMode.Classic)).toBe(MusicTrack.PuzzleBattle);
  });

  it('returns Electrofest for Crazy game mode', () => {
    expect(resolveMusicTrack('game', GameMode.Crazy)).toBe(MusicTrack.Electrofest);
  });

  it('returns PuzzleBattle for Choice game mode', () => {
    expect(resolveMusicTrack('game', GameMode.Choice)).toBe(MusicTrack.PuzzleBattle);
  });

  it('returns BitLord for Chaos game mode', () => {
    expect(resolveMusicTrack('game', GameMode.Chaos)).toBe(MusicTrack.BitLord);
  });

  it('returns SpaceDance for extraCrazy special mode', () => {
    expect(resolveMusicTrack('game', GameMode.Choice, 'extraCrazy')).toBe(MusicTrack.SpaceDance);
  });

  it('returns MidnightWalk for cogitate special mode', () => {
    expect(resolveMusicTrack('game', undefined, 'cogitate')).toBe(MusicTrack.MidnightWalk);
  });

  it('returns ModernFuturistic for challenge special mode', () => {
    expect(resolveMusicTrack('game', undefined, 'challenge')).toBe(MusicTrack.ModernFuturistic);
  });

  it('special mode takes priority over game mode', () => {
    expect(resolveMusicTrack('game', GameMode.Classic, 'extraCrazy')).toBe(MusicTrack.SpaceDance);
  });

  it('returns null for unknown screen', () => {
    expect(resolveMusicTrack('unknown')).toBeNull();
  });

  it('returns null for game screen without game mode', () => {
    expect(resolveMusicTrack('game')).toBeNull();
  });
});
