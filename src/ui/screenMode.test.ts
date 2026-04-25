import { describe, it, expect, vi } from 'vitest';
import { resolveModeAttribute } from './screenMode';
import { GameMode } from '../engine/types';

describe('resolveModeAttribute', () => {
  describe('non-game screens', () => {
    it.each([
      ['menu', 'menu'],
      ['classic', 'classic'],
      ['crazy', 'crazy'],
      ['choice', 'choice'],
      ['choice-detail', 'choice'],
      ['chaos', 'chaos'],
      ['challenge', 'classic'],
      ['challenge-game', 'classic'],
      ['classified', 'classic'],
      ['classified-detail', 'classic'],
      ['classified-game', 'classic'],
      ['cogitate', 'menu'],
      ['career', 'menu'],
      ['code', 'menu'],
      ['config', 'menu'],
    ] as const)('kind=%s → %s', (kind, expected) => {
      expect(resolveModeAttribute({ kind })).toBe(expected);
    });
  });

  describe('game screens require a gameMode', () => {
    it.each([
      [GameMode.Classic, 'classic'],
      [GameMode.Crazy, 'crazy'],
      [GameMode.Choice, 'choice'],
      [GameMode.Chaos, 'chaos'],
    ] as const)('mode=%s → %s', (mode, expected) => {
      expect(resolveModeAttribute({ kind: 'game' }, mode)).toBe(expected);
    });

    it('falls back to classic and warns when gameMode is missing', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
        // suppress noise — we only want to assert the call count
      });
      expect(resolveModeAttribute({ kind: 'game' })).toBe('classic');
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });
  });

  it('returns menu for unknown screen kinds', () => {
    expect(resolveModeAttribute({ kind: 'totally-fake-screen' })).toBe('menu');
  });
});
