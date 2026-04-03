/**
 * Small non-interactive SVG showing a 4×4 checkerboard with representative
 * pieces, rendered using a theme's color values directly (not CSS variables).
 * This allows previewing a theme other than the currently active one.
 */

import type { Theme } from '../themes/theme';

interface BoardPreviewProps {
  theme: Theme;
  size: number;
}

export default function BoardPreview({ theme, size }: BoardPreviewProps) {
  return (
    <svg
      viewBox="0 0 4 4"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ borderRadius: 4, border: `2px solid ${theme.boardBorder}` }}
    >
      {Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 4 }, (_, col) => (
          <rect
            key={`${String(row)}-${String(col)}`}
            x={col}
            y={row}
            width={1}
            height={1}
            fill={(row + col) % 2 === 0 ? theme.boardLight : theme.boardDark}
          />
        )),
      )}
      <circle
        cx={1.5}
        cy={0.5}
        r={0.35}
        fill={theme.pieceWhite}
        stroke={theme.pieceWhiteStroke}
        strokeWidth={0.06}
      />
      <circle
        cx={2.5}
        cy={1.5}
        r={0.35}
        fill={theme.pieceBlack}
        stroke={theme.pieceBlackStroke}
        strokeWidth={0.06}
      />
      <rect x={1} y={2} width={1} height={1} fill={theme.highlightLegal} opacity={0.5} />
    </svg>
  );
}
