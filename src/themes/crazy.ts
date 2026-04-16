import type { Theme } from './theme';

export const crazyTheme: Theme = {
  name: 'Crazy',
  id: 'crazy',
  boardLight: '#FFFFFF',
  boardDark: '#1A1A1A',
  boardBorder: '#333333',
  pieceWhite: '#FFFDE7',
  pieceWhiteStroke: '#DAA520',
  pieceBlack: '#DAA520',
  pieceBlackStroke: '#8B6914',
  highlightLegal: 'rgba(255, 82, 82, 0.55)',
  highlightSelected: 'rgba(213, 0, 0, 0.6)',
  highlightLastMove: 'rgba(183, 28, 28, 0.35)',
  highlightHover: 'rgba(255, 255, 255, 0.12)',
  coordText: 'rgba(180, 240, 255, 0.7)',
  uiBg: '#FFD600',
  uiText: '#1A1A1A',
  // Darkened from #D50000 to #A30000 so that accent text meets WCAG AA
  // (4.5:1) against the bright yellow uiBg for normal text sizes.
  uiAccent: '#A30000',
  uiDanger: '#8B0000',
  uiSuccess: '#1B5E20',
  uiWarning: '#BF360C',
  uiError: '#8B0000',
  uiSurface: '#FFFFFF',
  uiBorder: 'rgba(26, 26, 26, 0.3)',
  uiHeading: '#1A1A1A',
  // Increased from 0.7 to 0.85 so the subtitle is readable on yellow.
  uiTextMuted: 'rgba(26, 26, 26, 0.85)',
  uiAccentContrast: '#FFFFFF',
  pieceShadow: true,
};
