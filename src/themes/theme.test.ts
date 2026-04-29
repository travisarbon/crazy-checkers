/**
 * Theme contract tests (P1.1).
 *
 * Locks the `Theme` interface for every entry in `THEMES` so a future
 * palette tweak that drops a field, or registers a half-populated theme,
 * fails CI instead of shipping a broken re-skin.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { THEMES, applyTheme, DEFAULT_THEME_ID, type Theme } from './theme';
import { marginNotesTheme } from './marginnotes';

const REQUIRED_STRING_FIELDS: (keyof Theme)[] = [
  'name',
  'id',
  'boardLight',
  'boardDark',
  'boardBorder',
  'pieceWhite',
  'pieceWhiteStroke',
  'pieceBlack',
  'pieceBlackStroke',
  'highlightLegal',
  'highlightSelected',
  'highlightLastMove',
  'highlightHover',
  'coordText',
  'uiBg',
  'uiText',
  'uiAccent',
  'uiDanger',
  'uiSuccess',
  'uiWarning',
  'uiError',
  'uiSurface',
  'uiBorder',
  'uiHeading',
  'uiTextMuted',
  'uiAccentContrast',
];

describe('THEMES registry', () => {
  it('every registered theme satisfies the Theme interface', () => {
    for (const [key, theme] of Object.entries(THEMES)) {
      expect(theme.id, `${key}.id matches map key`).toBe(key);
      for (const field of REQUIRED_STRING_FIELDS) {
        const value = theme[field];
        expect(typeof value, `${key}.${field} type`).toBe('string');
        expect(
          (value as string).length,
          `${key}.${field} non-empty`,
        ).toBeGreaterThan(0);
      }
      expect(typeof theme.pieceShadow, `${key}.pieceShadow`).toBe('boolean');
    }
  });
});

describe('marginNotesTheme', () => {
  it('is registered under the margin-notes key', () => {
    expect(THEMES['margin-notes']).toBe(marginNotesTheme);
    expect(marginNotesTheme.id).toBe('margin-notes');
    expect(marginNotesTheme.name).toBe('Margin Notes');
  });

  it('uses paper-and-ink palette tokens', () => {
    // Lock the most semantically important values so a casual palette
    // edit cannot silently break the design-proposal contract.
    expect(marginNotesTheme.uiBg).toBe('#F5EFE2');
    expect(marginNotesTheme.uiAccent).toBe('#B83A2A');
    expect(marginNotesTheme.pieceShadow).toBe(false);
  });

  it('applyTheme writes every CSS custom property', () => {
    applyTheme(marginNotesTheme);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--board-light')).toBe('#F5EFE2');
    expect(root.style.getPropertyValue('--ui-accent')).toBe('#B83A2A');
    expect(root.style.getPropertyValue('--piece-shadow')).toBe('none');
  });
});

describe('crazyTheme (preserved as crazy-original)', () => {
  it('is registered under the crazy-original key', () => {
    expect(THEMES['crazy-original']).toBeDefined();
    expect(THEMES['crazy-original']?.id).toBe('crazy-original');
    expect(THEMES['crazy-original']?.name).toBe('Crazy (Original)');
  });

  it('keeps the bright-yellow palette unchanged', () => {
    // Palette regression net — if a future edit silently darkens or
    // re-themes the legacy palette, the migration promise is broken.
    const theme = THEMES['crazy-original'];
    expect(theme?.uiBg).toBe('#FFD600');
    expect(theme?.uiAccent).toBe('#A30000');
    expect(theme?.pieceShadow).toBe(true);
  });

  it('has no entry under the bare "crazy" key after the rename', () => {
    expect(THEMES['crazy']).toBeUndefined();
  });
});

describe('DEFAULT_THEME_ID', () => {
  it('points at a valid registered theme', () => {
    expect(THEMES[DEFAULT_THEME_ID]).toBeDefined();
  });

  it('is margin-notes after the P6.1 cutover', () => {
    expect(DEFAULT_THEME_ID).toBe('margin-notes');
  });
});

describe('applyTheme — body[data-theme] substrate (P3.1)', () => {
  beforeEach(() => {
    delete document.body.dataset.theme;
  });

  afterEach(() => {
    delete document.body.dataset.theme;
  });

  it('sets body.dataset.theme to "margin-notes" when applying marginNotesTheme', () => {
    applyTheme(marginNotesTheme);
    expect(document.body.dataset.theme).toBe('margin-notes');
  });

  it('overwrites body.dataset.theme on subsequent applyTheme calls', () => {
    const cork = THEMES.cork;
    expect(cork).toBeDefined();
    applyTheme(marginNotesTheme);
    expect(document.body.dataset.theme).toBe('margin-notes');
    if (cork) applyTheme(cork);
    expect(document.body.dataset.theme).toBe('cork');
  });

  it('binds body.dataset.theme to theme.id verbatim — no transformation', () => {
    for (const id of Object.keys(THEMES)) {
      const theme = THEMES[id];
      if (!theme) continue;
      applyTheme(theme);
      expect(document.body.dataset.theme).toBe(theme.id);
    }
  });
});
