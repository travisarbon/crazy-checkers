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

  it('returns null for choice screen so menu music keeps playing until a game starts', () => {
    expect(resolveMusicTrack('choice')).toBeNull();
  });

  it('returns null for choice-detail screen so menu music keeps playing until a game starts', () => {
    expect(resolveMusicTrack('choice-detail')).toBeNull();
  });

  it('returns ModernFuturistic for challenge screen', () => {
    expect(resolveMusicTrack('challenge')).toBe(MusicTrack.ModernFuturistic);
  });

  it('returns ModernFuturistic for challenge-game screen', () => {
    expect(resolveMusicTrack('challenge-game')).toBe(MusicTrack.ModernFuturistic);
  });

  it('returns PuzzleBattle for classified screen', () => {
    expect(resolveMusicTrack('classified')).toBe(MusicTrack.PuzzleBattle);
  });

  it('returns PuzzleBattle for classified-detail screen', () => {
    expect(resolveMusicTrack('classified-detail')).toBe(MusicTrack.PuzzleBattle);
  });

  it('returns null for cogitate screen so menu music keeps playing until a tool is launched', () => {
    expect(resolveMusicTrack('cogitate')).toBeNull();
  });

  it('returns null for unknown screen', () => {
    expect(resolveMusicTrack('unknown')).toBeNull();
  });

  it('returns null for game screen without game mode', () => {
    expect(resolveMusicTrack('game')).toBeNull();
  });
});
