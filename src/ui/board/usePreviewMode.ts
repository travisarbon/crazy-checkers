/**
 * usePreviewMode — uniform preview-mode clamp + affordance toggles.
 *
 * Applied by every concrete renderer so the Classified gallery (Task 35) can
 * drop many preview cards on one screen and rely on consistent rendering
 * behaviour across geometries.
 */

import { useMemo } from 'react';
import type { RenderMode } from './types';

export const PREVIEW_MIN_SIZE = 200;
export const PREVIEW_MAX_SIZE = 280;
export const PREVIEW_SATURATION = 0.85;
export const DEFAULT_INTERACTIVE_SIZE = 640;

export interface PreviewModeResult {
  readonly size: number;
  readonly interactive: boolean;
  readonly animate: boolean;
  readonly saturation: number;
  readonly tabbable: boolean;
}

export function usePreviewMode(
  mode: RenderMode,
  desiredSize?: number,
): PreviewModeResult {
  return useMemo(() => {
    if (mode === 'preview') {
      const target = desiredSize ?? PREVIEW_MAX_SIZE;
      const clamped = Math.max(
        PREVIEW_MIN_SIZE,
        Math.min(PREVIEW_MAX_SIZE, target),
      );
      return {
        size: clamped,
        interactive: false,
        animate: false,
        saturation: PREVIEW_SATURATION,
        tabbable: false,
      };
    }
    return {
      size: desiredSize ?? DEFAULT_INTERACTIVE_SIZE,
      interactive: mode === 'interactive',
      animate: mode !== 'replay',
      saturation: 1,
      tabbable: mode === 'interactive',
    };
  }, [mode, desiredSize]);
}
