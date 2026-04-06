import ModeScreenShell from './ModeScreenShell';

interface CogitateScreenProps {
  onBack: () => void;
}

// Placeholder — full implementation in Task 22
export default function CogitateScreen({ onBack }: CogitateScreenProps) {
  return (
    <ModeScreenShell title="Cogitate" onBack={onBack} testId="cogitate-screen">
      <p>Cogitate sub-menu — content coming in Task 22.</p>
    </ModeScreenShell>
  );
}
