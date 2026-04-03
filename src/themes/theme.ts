/**
 * Theme type definition and CSS variable mapping.
 *
 * Each theme provides semantic color names that map to CSS custom properties.
 * The board SVG, piece components, and game chrome reference these properties
 * for all coloring, enabling instant theme switching without re-rendering.
 */

export interface Theme {
  readonly name: string;
  readonly id: string;

  // Board
  readonly boardLight: string;
  readonly boardDark: string;
  readonly boardBorder: string;

  // Pieces
  readonly pieceWhite: string;
  readonly pieceWhiteStroke: string;
  readonly pieceBlack: string;
  readonly pieceBlackStroke: string;

  // Highlights (used in Task 2.2+)
  readonly highlightLegal: string;
  readonly highlightSelected: string;
  readonly highlightLastMove: string;
  readonly highlightHover: string;

  // UI chrome (sidebar, menus — used in Task 2.4+)
  readonly uiBg: string;
  readonly uiText: string;
  readonly uiAccent: string;
  readonly uiDanger: string;

  // Visual polish
  readonly pieceShadow: boolean;
}

/**
 * Applies a theme by setting CSS custom properties on the document root.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.style.setProperty('--board-light', theme.boardLight);
  root.style.setProperty('--board-dark', theme.boardDark);
  root.style.setProperty('--board-border', theme.boardBorder);
  root.style.setProperty('--piece-white', theme.pieceWhite);
  root.style.setProperty('--piece-white-stroke', theme.pieceWhiteStroke);
  root.style.setProperty('--piece-black', theme.pieceBlack);
  root.style.setProperty('--piece-black-stroke', theme.pieceBlackStroke);
  root.style.setProperty('--highlight-legal', theme.highlightLegal);
  root.style.setProperty('--highlight-selected', theme.highlightSelected);
  root.style.setProperty('--highlight-last-move', theme.highlightLastMove);
  root.style.setProperty('--highlight-hover', theme.highlightHover);
  root.style.setProperty('--piece-shadow', theme.pieceShadow ? 'url(#piece-shadow)' : 'none');
  root.style.setProperty('--ui-bg', theme.uiBg);
  root.style.setProperty('--ui-text', theme.uiText);
  root.style.setProperty('--ui-accent', theme.uiAccent);
  root.style.setProperty('--ui-danger', theme.uiDanger);

  // Apply page background
  document.body.style.background = theme.uiBg;
  document.body.style.margin = '0';
}

import { classicTheme } from './classic';
import { modernTheme } from './modern';
import { highContrastTheme } from './highContrast';

export const THEMES: Record<string, Theme> = {
  classic: classicTheme,
  modern: modernTheme,
  'high-contrast': highContrastTheme,
};

export const DEFAULT_THEME_ID = 'classic';
