/**
 * React hook that manages the progressive unlock system.
 *
 * Loads cached unlock state from localStorage on mount (synchronous),
 * triggers async re-evaluation, detects newly unlocked modes, and
 * provides callbacks for marking animations as seen and forcing refresh.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { UnlockSnapshot } from '../../persistence/unlockState';
import {
  loadUnlockState,
  saveUnlockState,
} from '../../persistence/unlockState';
import type { PersistedUnlockState } from '../../persistence/unlockState';
import { evaluateUnlocks } from '../../persistence/unlockEvaluator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UnlockInfo {
  /** Which hidden modes are currently unlocked. */
  snapshot: UnlockSnapshot;
  /** Which modes were *just* unlocked and should show the reveal animation. */
  newlyUnlocked: {
    choice: boolean;
    classified: boolean;
    chaos: boolean;
  };
  /** Mark a mode's reveal animation as complete (clears newlyUnlocked flag). */
  markSeen: (mode: 'choice' | 'classified' | 'chaos') => void;
  /** Force re-evaluation of unlock conditions. */
  refreshUnlocks: () => void;
  /** True while the async evaluation is in progress. */
  evaluating: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useUnlockState(): UnlockInfo {
  // Load cached state synchronously on first render (no flicker)
  const [state, setState] = useState<PersistedUnlockState>(() => loadUnlockState());
  const [evaluating, setEvaluating] = useState(false);

  // Derive newlyUnlocked from snapshot vs seen flags
  const [newlyUnlocked, setNewlyUnlocked] = useState(() => ({
    choice: state.snapshot.choiceUnlocked && !state.seen.choiceSeen,
    classified: state.snapshot.classifiedUnlocked && !state.seen.classifiedSeen,
    chaos: state.snapshot.chaosUnlocked && !state.seen.chaosSeen,
  }));

  // Track the latest evaluation to handle races
  const evaluationCounter = useRef(0);

  const runEvaluation = useCallback(async () => {
    const evalId = ++evaluationCounter.current;
    setEvaluating(true);

    try {
      const newSnapshot = await evaluateUnlocks();

      // Bail if a newer evaluation was started
      if (evalId !== evaluationCounter.current) return;

      setState((prev) => {
        const updated: PersistedUnlockState = {
          ...prev,
          snapshot: newSnapshot,
        };
        saveUnlockState(updated);
        return updated;
      });

      // Detect newly unlocked modes
      const currentState = loadUnlockState();
      setNewlyUnlocked({
        choice: newSnapshot.choiceUnlocked && !currentState.seen.choiceSeen,
        classified: newSnapshot.classifiedUnlocked && !currentState.seen.classifiedSeen,
        chaos: newSnapshot.chaosUnlocked && !currentState.seen.chaosSeen,
      });
    } finally {
      if (evalId === evaluationCounter.current) {
        setEvaluating(false);
      }
    }
  }, []);

  // Run evaluation on mount
  useEffect(() => {
    void runEvaluation();
  }, [runEvaluation]);

  const markSeen = useCallback((mode: 'choice' | 'classified' | 'chaos') => {
    setState((prev) => {
      const seenKey = `${mode}Seen` as keyof typeof prev.seen;
      const updated: PersistedUnlockState = {
        ...prev,
        seen: { ...prev.seen, [seenKey]: true },
      };
      saveUnlockState(updated);
      return updated;
    });
    setNewlyUnlocked((prev) => ({ ...prev, [mode]: false }));
  }, []);

  const refreshUnlocks = useCallback(() => {
    void runEvaluation();
  }, [runEvaluation]);

  return {
    snapshot: state.snapshot,
    newlyUnlocked,
    markSeen,
    refreshUnlocks,
    evaluating,
  };
}
