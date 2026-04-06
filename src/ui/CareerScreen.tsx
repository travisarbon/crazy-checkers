import ModeScreenShell from './ModeScreenShell';

interface CareerScreenProps {
  onBack: () => void;
}

// Placeholder — full implementation in Task 22
export default function CareerScreen({ onBack }: CareerScreenProps) {
  return (
    <ModeScreenShell title="Career" onBack={onBack} testId="career-screen">
      <p>Career sub-menu — content coming in Task 22.</p>
    </ModeScreenShell>
  );
}
