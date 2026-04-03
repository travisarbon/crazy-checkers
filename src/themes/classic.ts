import type { Theme } from './theme';

export const classicTheme: Theme = {
  name: 'Classic',
  id: 'classic',
  boardLight: '#F0D9B5',
  boardDark: '#B58863',
  boardBorder: '#6B3A2A',
  pieceWhite: '#FFF8E7',
  pieceWhiteStroke: '#C8A96E',
  pieceBlack: '#3B2314',
  pieceBlackStroke: '#1A0F08',
  highlightLegal: 'rgba(106, 176, 76, 0.5)',
  highlightSelected: 'rgba(255, 215, 0, 0.55)',
  highlightLastMove: 'rgba(66, 135, 245, 0.35)',
  highlightHover: 'rgba(255, 215, 100, 0.15)',
  uiBg: '#2C1810',
  uiText: '#F0D9B5',
  uiAccent: '#D4A843',
  uiDanger: '#E53E3E',
  pieceShadow: true,
};
