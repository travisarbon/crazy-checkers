// Margin Notes — paper-and-ink theme. See
// Documentation/UI Overhaul/P1.1-Margin-Notes-Theme-File.md for rationale
// and palette story.

import type { Theme } from './theme';

export const marginNotesTheme: Theme = {
  name: 'Margin Notes',
  id: 'margin-notes',

  // Board — bone paper with a slightly warmer dark square
  boardLight: '#F5EFE2',
  boardDark: '#E4DCC8',
  boardBorder: '#1F1B16',

  // Pieces — drawn, not rendered. Ink outline on cream fill.
  pieceWhite: '#FAF6EA',
  pieceWhiteStroke: '#1F1B16',
  pieceBlack: '#1F1B16',
  pieceBlackStroke: '#0B0908',

  // Highlights — the pencil-set palette, layered like marginalia
  highlightLegal: 'rgba(110, 142, 58, 0.45)', // pencil green
  highlightSelected: 'rgba(245, 213, 71, 0.65)', // highlighter yellow
  highlightLastMove: 'rgba(62, 91, 170, 0.35)', // ballpoint blue
  highlightHover: 'rgba(31, 27, 22, 0.06)',

  coordText: 'rgba(31, 27, 22, 0.55)',

  // UI chrome — paper + ink
  uiBg: '#F5EFE2',
  uiSurface: '#FBF7EC',
  uiText: '#1F1B16',
  uiHeading: '#0B0908',
  uiTextMuted: 'rgba(31, 27, 22, 0.65)',
  uiBorder: 'rgba(31, 27, 22, 0.18)',

  // The single "loud" hue — used for the brand mark and for active events
  uiAccent: '#B83A2A', // India-ink red
  uiAccentContrast: '#FBF7EC',

  // Status — borrowed straight from the pencil set
  uiSuccess: '#6E8E3A', // pencil green
  uiWarning: '#E8743C', // wax-crayon orange (Chaos-only normally)
  uiError: '#B83A2A',
  uiDanger: '#B83A2A',

  // It's a drawing, not a 3D scene
  pieceShadow: false,
};
