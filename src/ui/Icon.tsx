/**
 * Icon — small, theme-aware SVG icon component used across the app.
 * All icons render at 1em × 1em by default and inherit currentColor so
 * they blend naturally with surrounding text / button color.
 */

import type { CSSProperties } from 'react';

export type IconName =
  | 'crown'
  | 'shield'
  | 'puzzle'
  | 'sparkles'
  | 'stack'
  | 'chaos'
  | 'brain'
  | 'chart'
  | 'code'
  | 'cog'
  | 'trophy'
  | 'play-fresh'
  | 'undo'
  | 'flag'
  | 'home'
  | 'arrow-left'
  | 'arrow-right'
  | 'check'
  | 'lock'
  | 'question';

interface IconProps {
  readonly name: IconName;
  readonly size?: number | string;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly title?: string;
}

export default function Icon({ name, size = '1em', className, style, title }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    style,
    role: title ? ('img' as const) : undefined,
    'aria-hidden': title ? undefined : (true as const),
    'aria-label': title,
    focusable: false,
  };

  switch (name) {
    case 'crown':
      return (
        <svg {...common}>
          <path d="M3 8l4 4 5-6 5 6 4-4v10H3z" />
          <line x1="3" y1="21" x2="21" y2="21" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-0.5-8-4-8-9V6z" />
        </svg>
      );
    case 'puzzle':
      return (
        <svg {...common}>
          <path d="M4 7h4V4a2 2 0 1 1 4 0v3h4a1 1 0 0 1 1 1v4h-3a2 2 0 1 0 0 4h3v4a1 1 0 0 1-1 1h-4v-3a2 2 0 1 0-4 0v3H5a1 1 0 0 1-1-1v-4h3a2 2 0 1 1 0-4H4z" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg {...common}>
          <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z" />
          <path d="M19 14l0.8 2 2 0.8-2 0.8-0.8 2-0.8-2-2-0.8 2-0.8z" />
          <path d="M5 14l0.8 2 2 0.8-2 0.8-0.8 2-0.8-2-2-0.8 2-0.8z" />
        </svg>
      );
    case 'stack':
      return (
        <svg {...common}>
          <path d="M12 2l10 5-10 5L2 7z" />
          <path d="M2 12l10 5 10-5" />
          <path d="M2 17l10 5 10-5" />
        </svg>
      );
    case 'chaos':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M4 10l6 2-4 5 5-4 2 6 2-6 5 4-4-5 6-2-6-2 4-5-5 4-2-6-2 6-5-4 4 5z" />
        </svg>
      );
    case 'brain':
      return (
        <svg {...common}>
          <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h1V4z" />
          <path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h-1V4z" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <line x1="4" y1="20" x2="4" y2="10" />
          <line x1="10" y1="20" x2="10" y2="4" />
          <line x1="16" y1="20" x2="16" y2="14" />
          <line x1="22" y1="20" x2="2" y2="20" />
        </svg>
      );
    case 'code':
      return (
        <svg {...common}>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
          <line x1="13" y1="4" x2="11" y2="20" />
        </svg>
      );
    case 'cog':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      );
    case 'trophy':
      return (
        <svg {...common}>
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="M7 4h10v6a5 5 0 1 1-10 0z" />
          <path d="M17 5h3v3a3 3 0 0 1-3 3" />
          <path d="M7 5H4v3a3 3 0 0 0 3 3" />
        </svg>
      );
    case 'play-fresh':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'undo':
      return (
        <svg {...common}>
          <polyline points="9 14 4 9 9 4" />
          <path d="M4 9h10a6 6 0 1 1 0 12h-3" />
        </svg>
      );
    case 'flag':
      return (
        <svg {...common}>
          <path d="M4 21V4" />
          <path d="M4 4h12l-2 4 2 4H4" />
        </svg>
      );
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
        </svg>
      );
    case 'arrow-left':
      return (
        <svg {...common}>
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      );
    case 'arrow-right':
      return (
        <svg {...common}>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case 'lock':
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 1 1 8 0v4" />
        </svg>
      );
    case 'question':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-0.8 0.4-1 1-1 1.7V14" />
          <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}
