import ModeScreenShell from './ModeScreenShell';

interface ChoiceGalleryScreenProps {
  onBack: () => void;
}

// Placeholder — full implementation in Task 20
export default function ChoiceGalleryScreen({ onBack }: ChoiceGalleryScreenProps) {
  return (
    <ModeScreenShell title="Choice" onBack={onBack} testId="choice-screen">
      <p>Choice gallery — content coming in Task 20.</p>
    </ModeScreenShell>
  );
}
