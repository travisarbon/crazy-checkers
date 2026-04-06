/**
 * Reusable layout shell for all sub-menu screens.
 * Extracted from ConfigScreen to provide a consistent header/content
 * pattern with back-navigation, focus management, and audio feedback.
 */

import { useEffect, useRef } from 'react';
import { useAudioManager } from '../audio/useAudioManager';
import { SoundEvent } from '../audio/types';
import styles from './ModeScreenShell.module.css';

export interface ModeScreenShellProps {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
  testId?: string;
}

export default function ModeScreenShell({ title, onBack, children, testId = 'mode-screen' }: ModeScreenShellProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const audioManager = useAudioManager();

  useEffect(() => {
    titleRef.current?.focus();
    window.scrollTo(0, 0);
  }, []);

  function handleBack() {
    audioManager?.play(SoundEvent.MenuClick);
    onBack();
  }

  return (
    <div className={styles.shell} data-testid={testId}>
      <header className={styles.header}>
        <button
          className={styles.backButton}
          onClick={handleBack}
          aria-label="Back to previous screen"
        >
          &larr; Back
        </button>
        <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
          {title}
        </h1>
      </header>
      <main className={styles.sections} role="main">
        {children}
      </main>
    </div>
  );
}
