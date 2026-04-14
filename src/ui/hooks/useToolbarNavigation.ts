/**
 * Reusable keyboard navigation helper for WAI-ARIA Toolbar and Tabs patterns.
 *
 * Produces a ref callback and an `onKeyDown` handler that together intercept
 * Left/Right (and optionally Up/Down) arrow keys, Home, and End to move focus
 * between sibling focusable elements within the bound container. The
 * focusable elements are discovered lazily via a selector.
 *
 * The hook intentionally returns a ref *callback* (not a ref object) so that
 * callers can pass it directly to the `ref` prop without the lint rule
 * `react-hooks/refs` flagging access to a ref's `.current` during render.
 *
 * Ref: https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/ and
 *      https://www.w3.org/WAI/ARIA/apg/patterns/tabs/.
 */

import { useCallback, useRef } from 'react';

export interface ToolbarNavigationOptions {
  /** CSS selector identifying focusable children. Defaults to buttons + [role="tab"] + [role="radio"]. */
  readonly selector?: string;
  /** If true (default) Left/Right arrows move focus horizontally. */
  readonly horizontal?: boolean;
  /** If true, Up/Down arrows also move focus. */
  readonly vertical?: boolean;
}

export interface ToolbarNavigationBindings<T extends HTMLElement> {
  readonly setContainer: (node: T | null) => void;
  readonly onKeyDown: (event: React.KeyboardEvent<T>) => void;
}

const DEFAULT_SELECTOR =
  'button:not([disabled]), [role="tab"]:not([aria-disabled="true"]), [role="radio"]:not([aria-disabled="true"])';

export function useToolbarNavigation<T extends HTMLElement>(
  options: ToolbarNavigationOptions = {},
): ToolbarNavigationBindings<T> {
  const { selector = DEFAULT_SELECTOR, horizontal = true, vertical = false } = options;
  const containerRef = useRef<T | null>(null);

  const setContainer = useCallback((node: T | null) => {
    containerRef.current = node;
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<T>) => {
      const container = containerRef.current;
      if (!container) return;

      const items = Array.from(
        container.querySelectorAll<HTMLElement>(selector),
      );

      if (items.length === 0) return;

      const activeElement = document.activeElement;
      const currentIndex = items.findIndex((el) => el === activeElement);

      let nextIndex: number | null = null;
      switch (event.key) {
        case 'ArrowRight':
          if (!horizontal) return;
          nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
          break;
        case 'ArrowLeft':
          if (!horizontal) return;
          nextIndex =
            currentIndex < 0
              ? 0
              : (currentIndex - 1 + items.length) % items.length;
          break;
        case 'ArrowDown':
          if (!vertical) return;
          nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
          break;
        case 'ArrowUp':
          if (!vertical) return;
          nextIndex =
            currentIndex < 0
              ? 0
              : (currentIndex - 1 + items.length) % items.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = items.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      const target = items[nextIndex];
      if (target) {
        target.focus();
      }
    },
    [selector, horizontal, vertical],
  );

  return { setContainer, onKeyDown };
}
