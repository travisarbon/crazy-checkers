import ModeScreenShell from './ModeScreenShell';

interface CodeScreenProps {
  onBack: () => void;
}

// Placeholder — full implementation in Task 22
export default function CodeScreen({ onBack }: CodeScreenProps) {
  return (
    <ModeScreenShell title="Code" onBack={onBack} testId="code-screen">
      <p>Code sub-menu — content coming in Task 22.</p>
    </ModeScreenShell>
  );
}
