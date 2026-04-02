/**
 * Settings and theme selection screen.
 * Task 4.2 implements theme picker, animation speed, and move confirmation.
 */

interface ConfigScreenProps {
  onBack: () => void;
}

export default function ConfigScreen({ onBack }: ConfigScreenProps) {
  return (
    <div data-testid="config-screen">
      <button onClick={onBack} aria-label="Back to main menu">
        &larr; Back
      </button>
      <h1>Configure</h1>
      <p>Settings coming soon (Task 4.2).</p>
    </div>
  );
}
