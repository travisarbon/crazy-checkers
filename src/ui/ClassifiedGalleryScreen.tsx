import ModeScreenShell from './ModeScreenShell';

interface ClassifiedGalleryScreenProps {
  onBack: () => void;
}

// Placeholder — full implementation in Task 21
export default function ClassifiedGalleryScreen({ onBack }: ClassifiedGalleryScreenProps) {
  return (
    <ModeScreenShell title="Classified" onBack={onBack} testId="classified-screen">
      <p>Classified gallery — content coming in Task 21.</p>
    </ModeScreenShell>
  );
}
