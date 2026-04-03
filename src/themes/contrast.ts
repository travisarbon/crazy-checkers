import type { Theme } from './theme';

export const contrastTheme: Theme = {
  name: 'Contrast',
  id: 'contrast',
  boardLight: '#FFFFFF',
  boardDark: '#000000',
  boardBorder: '#FFD700',
  pieceWhite: '#FFFFFF',
  pieceWhiteStroke: '#FFD700',
  pieceBlack: '#000000',
  pieceBlackStroke: '#FF0000',
  highlightLegal: 'rgba(0, 255, 0, 0.7)',
  highlightSelected: 'rgba(255, 255, 0, 0.7)',
  highlightLastMove: 'rgba(0, 150, 255, 0.6)',
  highlightHover: 'rgba(255, 255, 0, 0.2)',
  uiBg: '#000000',
  uiText: '#FFFFFF',
  uiAccent: '#FFD700',
  uiDanger: '#FF0000',
  pieceShadow: false,
};
