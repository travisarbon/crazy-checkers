/**
 * EmptyStateIllustration — a small decorative SVG motif used to give
 * empty / locked states visual interest. Pure presentational, theme-aware
 * via currentColor inheritance.
 */

import type { CSSProperties } from 'react';

export type EmptyStateVariant = 'locked' | 'board' | 'checkmark' | 'search';

interface EmptyStateIllustrationProps {
  readonly variant?: EmptyStateVariant;
  readonly size?: number;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly label?: string;
}

export default function EmptyStateIllustration({
  variant = 'board',
  size = 96,
  className,
  style,
  label,
}: EmptyStateIllustrationProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 96 96',
    xmlns: 'http://www.w3.org/2000/svg',
    className,
    style,
    role: label ? ('img' as const) : undefined,
    'aria-hidden': label ? undefined : (true as const),
    'aria-label': label,
    'data-testid': 'empty-state-illustration',
  };

  if (variant === 'locked') {
    return (
      <svg {...common}>
        <rect
          x="24"
          y="42"
          width="48"
          height="38"
          rx="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          opacity="0.8"
        />
        <path
          d="M34 42 V30 a14 14 0 0 1 28 0 V42"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          opacity="0.8"
        />
        <circle cx="48" cy="60" r="4" fill="currentColor" />
        <line
          x1="48"
          y1="60"
          x2="48"
          y2="70"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (variant === 'checkmark') {
    return (
      <svg {...common}>
        <circle
          cx="48"
          cy="48"
          r="36"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          opacity="0.7"
        />
        <path
          d="M32 49 L44 60 L66 36"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (variant === 'search') {
    return (
      <svg {...common}>
        <circle
          cx="42"
          cy="42"
          r="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          opacity="0.8"
        />
        <line
          x1="58"
          y1="58"
          x2="76"
          y2="76"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // "board" variant — 4×4 decorative checkerboard with a single piece
  return (
    <svg {...common}>
      {Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 4 }, (_, col) => {
          const dark = (row + col) % 2 === 1;
          return (
            <rect
              key={`${String(row)}-${String(col)}`}
              x={16 + col * 16}
              y={16 + row * 16}
              width="16"
              height="16"
              fill={dark ? 'currentColor' : 'transparent'}
              opacity={dark ? 0.25 : 1}
              stroke="currentColor"
              strokeWidth="1"
              strokeOpacity="0.4"
            />
          );
        }),
      )}
      <circle
        cx="40"
        cy="56"
        r="6"
        fill="currentColor"
        opacity="0.9"
      />
      <circle
        cx="40"
        cy="56"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.5"
      />
    </svg>
  );
}
