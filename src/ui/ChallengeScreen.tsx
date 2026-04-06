import ModeScreenShell from './ModeScreenShell';

interface ChallengeScreenProps {
  onBack: () => void;
}

// Placeholder — full implementation in Task 19
export default function ChallengeScreen({ onBack }: ChallengeScreenProps) {
  return (
    <ModeScreenShell title="Challenge" onBack={onBack} testId="challenge-screen">
      <p>Challenge mode sub-menu — content coming in Task 19.</p>
    </ModeScreenShell>
  );
}
