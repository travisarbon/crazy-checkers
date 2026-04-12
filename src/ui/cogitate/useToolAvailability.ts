/**
 * Queries IndexedDB for game history and computes per-tool availability
 * for the Cogitate home screen.
 */

import { useEffect, useState } from 'react';
import {
  getGameRecordCount,
  hasAnalyzedGamesWithTrainingPositions,
} from '../../persistence/gameHistory';

export interface ToolAvailability {
  readonly replayAvailable: boolean;
  readonly analysisAvailable: boolean;
  readonly trainingAvailable: boolean;
  readonly freePlayAvailable: true;
  readonly isLoaded: boolean;
}

const INITIAL: ToolAvailability = {
  replayAvailable: false,
  analysisAvailable: false,
  trainingAvailable: false,
  freePlayAvailable: true,
  isLoaded: false,
};

export function useToolAvailability(refreshKey = 0): ToolAvailability {
  const [state, setState] = useState(INITIAL);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [count, hasTraining] = await Promise.all([
          getGameRecordCount(),
          hasAnalyzedGamesWithTrainingPositions(),
        ]);
        if (cancelled) return;
        const hasGames = count > 0;
        setState({
          replayAvailable: hasGames,
          analysisAvailable: hasGames,
          trainingAvailable: hasTraining,
          freePlayAvailable: true,
          isLoaded: true,
        });
      } catch {
        if (cancelled) return;
        setState({
          replayAvailable: false,
          analysisAvailable: false,
          trainingAvailable: false,
          freePlayAvailable: true,
          isLoaded: true,
        });
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return state;
}
