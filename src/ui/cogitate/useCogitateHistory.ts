/**
 * Manages browser history (pushState/popState) for Cogitate's two-level
 * internal navigation (home ↔ tool). Coordinates with App.tsx's top-level
 * popstate listener via capture-phase + stopImmediatePropagation.
 */

import { useEffect, useRef } from 'react';

export type CogitateViewKind =
  | 'cogitate-home'
  | 'cogitate-replay'
  | 'cogitate-analysis'
  | 'cogitate-training'
  | 'cogitate-freeplay';

export interface CogitateView {
  readonly kind: CogitateViewKind;
}

interface CogitateHistoryEntry {
  screenKind: 'cogitate';
  cogitateView?: CogitateViewKind;
  parentKind: 'cogitate' | 'menu';
}

interface UseCogitateHistoryOptions {
  readonly view: CogitateView;
  readonly setView: (view: CogitateView) => void;
}

export function useCogitateHistory({ view, setView }: UseCogitateHistoryOptions): void {
  const prevKindRef = useRef<CogitateViewKind>(view.kind);
  const skipNextPopstateRef = useRef(false);

  useEffect(() => {
    const prev = prevKindRef.current;
    const curr = view.kind;
    if (prev === curr) return;
    prevKindRef.current = curr;

    if (prev === 'cogitate-home' && curr !== 'cogitate-home') {
      const entry: CogitateHistoryEntry = {
        screenKind: 'cogitate',
        cogitateView: curr,
        parentKind: 'cogitate',
      };
      window.history.pushState(entry, '');
    } else if (prev !== 'cogitate-home' && curr === 'cogitate-home') {
      skipNextPopstateRef.current = true;
      window.history.back();
    }
  }, [view.kind]);

  useEffect(() => {
    function handlePopState(event: PopStateEvent) {
      if (skipNextPopstateRef.current) {
        skipNextPopstateRef.current = false;
        event.stopImmediatePropagation();
        return;
      }
      const state = event.state as {
        screenKind?: string;
        cogitateView?: CogitateViewKind;
      } | null;
      if (!state || state.screenKind !== 'cogitate') {
        return;
      }
      if (state.cogitateView) {
        event.stopImmediatePropagation();
        prevKindRef.current = state.cogitateView;
        setView({ kind: state.cogitateView });
      } else if (prevKindRef.current !== 'cogitate-home') {
        event.stopImmediatePropagation();
        prevKindRef.current = 'cogitate-home';
        setView({ kind: 'cogitate-home' });
      }
    }
    window.addEventListener('popstate', handlePopState, true);
    return () => {
      window.removeEventListener('popstate', handlePopState, true);
    };
  }, [setView]);
}
