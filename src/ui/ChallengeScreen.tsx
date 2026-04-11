import { useState, useEffect } from 'react';
import ModeScreenShell from './ModeScreenShell';
import { getAllChallengeRecords, computeChallengeProgress } from '../persistence/challengeRecords';
import type { ChallengeProgressSnapshot } from '../persistence/challengeRecords';

interface ChallengeScreenProps {
  onBack: () => void;
  onStartPuzzle?: (puzzleId: number) => void;
}

// Placeholder — full sub-menu implementation in Task 18.4
export default function ChallengeScreen({ onBack, onStartPuzzle }: ChallengeScreenProps) {
  const [progress, setProgress] = useState<ChallengeProgressSnapshot | null>(null);

  useEffect(() => {
    async function load() {
      const records = await getAllChallengeRecords();
      setProgress(computeChallengeProgress(records));
    }
    void load();
  }, []);

  const nextPuzzleId = progress?.nextPuzzleId ?? 1;

  return (
    <ModeScreenShell title="Challenge" onBack={onBack} testId="challenge-screen">
      <p style={{ marginBottom: '1rem' }}>
        {progress
          ? String(progress.puzzlesCompleted) + ' / 100 puzzles completed'
          : 'Loading...'}
      </p>
      {onStartPuzzle && (
        <button
          onClick={() => { onStartPuzzle(nextPuzzleId); }}
          style={{
            background: 'var(--ui-accent)',
            color: 'var(--ui-bg)',
            border: 'none',
            borderRadius: '6px',
            padding: '0.75rem 2rem',
            fontSize: '1.1rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          data-testid="challenge-continue"
        >
          {nextPuzzleId <= 100
            ? 'Continue - Puzzle ' + String(nextPuzzleId)
            : 'All Complete!'}
        </button>
      )}
    </ModeScreenShell>
  );
}
