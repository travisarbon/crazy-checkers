/**
 * useDiagramState — manages the diagram overlay state for the Free Play tool
 * (Task 21.5).
 *
 * Holds arrows, highlights, and annotations. The state is purely in-memory:
 * diagrams persist within a Free Play session but are not serialized.
 */

import { useCallback, useMemo, useState } from 'react';
import type { Square } from '../../engine/types';
import type {
  DiagramAnnotation,
  DiagramArrow,
  DiagramColor,
  DiagramHighlight,
  DiagramOverlayState,
} from '../../cogitate/types';

export type DiagramTool = 'arrow' | 'highlight' | 'annotation';

export interface UseDiagramStateReturn {
  readonly overlays: DiagramOverlayState;
  readonly activeTool: DiagramTool | null;
  readonly activeColor: DiagramColor;
  readonly setActiveTool: (tool: DiagramTool | null) => void;
  readonly setActiveColor: (color: DiagramColor) => void;
  readonly addArrow: (from: Square, to: Square) => void;
  readonly removeArrow: (from: Square, to: Square) => void;
  readonly toggleHighlight: (square: Square) => void;
  readonly setAnnotation: (square: Square, text: string) => void;
  readonly removeAnnotation: (square: Square) => void;
  readonly clearAll: () => void;
  readonly hasOverlays: boolean;
}

const EMPTY_OVERLAYS: DiagramOverlayState = {
  arrows: [],
  highlights: [],
  annotations: [],
};

const HIGHLIGHT_CYCLE: readonly (DiagramColor | null)[] = [
  null,
  'green',
  'red',
  'blue',
];

function nextHighlightColor(current: DiagramColor | undefined): DiagramColor | null {
  const idx = HIGHLIGHT_CYCLE.indexOf(current ?? null);
  const next = HIGHLIGHT_CYCLE[(idx + 1) % HIGHLIGHT_CYCLE.length];
  return next ?? null;
}

export function useDiagramState(): UseDiagramStateReturn {
  const [overlays, setOverlays] = useState(EMPTY_OVERLAYS);
  const [activeTool, setActiveTool] = useState<DiagramTool | null>(null);
  const [activeColor, setActiveColor] = useState<DiagramColor>('green');

  const addArrow = useCallback(
    (from: Square, to: Square) => {
      setOverlays((prev) => {
        const existing = prev.arrows.find(
          (a) => (a.from as number) === (from as number) && (a.to as number) === (to as number),
        );
        if (existing && existing.color === activeColor) {
          // Same-color duplicate → toggle off.
          return {
            ...prev,
            arrows: prev.arrows.filter((a) => a !== existing),
          };
        }
        // Different color or no existing → replace existing + add.
        const withoutOld = prev.arrows.filter(
          (a) => !((a.from as number) === (from as number) && (a.to as number) === (to as number)),
        );
        const newArrow: DiagramArrow = { from, to, color: activeColor };
        return { ...prev, arrows: [...withoutOld, newArrow] };
      });
    },
    [activeColor],
  );

  const removeArrow = useCallback((from: Square, to: Square) => {
    setOverlays((prev) => ({
      ...prev,
      arrows: prev.arrows.filter(
        (a) => !((a.from as number) === (from as number) && (a.to as number) === (to as number)),
      ),
    }));
  }, []);

  const toggleHighlight = useCallback((sq: Square) => {
    setOverlays((prev) => {
      const existing = prev.highlights.find(
        (h) => (h.square as number) === (sq as number),
      );
      const next = nextHighlightColor(existing?.color);
      const rest = prev.highlights.filter(
        (h) => (h.square as number) !== (sq as number),
      );
      if (next === null) {
        return { ...prev, highlights: rest };
      }
      const entry: DiagramHighlight = { square: sq, color: next };
      return { ...prev, highlights: [...rest, entry] };
    });
  }, []);

  const setAnnotation = useCallback((sq: Square, text: string) => {
    setOverlays((prev) => {
      const rest = prev.annotations.filter(
        (a) => (a.square as number) !== (sq as number),
      );
      if (text.trim() === '') {
        return { ...prev, annotations: rest };
      }
      const trimmed = text.slice(0, 32);
      const entry: DiagramAnnotation = { square: sq, text: trimmed };
      return { ...prev, annotations: [...rest, entry] };
    });
  }, []);

  const removeAnnotation = useCallback((sq: Square) => {
    setOverlays((prev) => ({
      ...prev,
      annotations: prev.annotations.filter(
        (a) => (a.square as number) !== (sq as number),
      ),
    }));
  }, []);

  const clearAll = useCallback(() => {
    setOverlays(EMPTY_OVERLAYS);
  }, []);

  const hasOverlays = useMemo(
    () =>
      overlays.arrows.length > 0 ||
      overlays.highlights.length > 0 ||
      overlays.annotations.length > 0,
    [overlays],
  );

  return {
    overlays,
    activeTool,
    activeColor,
    setActiveTool,
    setActiveColor,
    addArrow,
    removeArrow,
    toggleHighlight,
    setAnnotation,
    removeAnnotation,
    clearAll,
    hasOverlays,
  };
}
