/**
 * Modal dialog for Choice/Classified gallery items.
 * Supports cycling navigation (previous/next), keyboard shortcuts,
 * focus trap, Escape to close, and scroll lock.
 */

import { useEffect, useRef } from 'react';
import styles from './GalleryDialogBox.module.css';

export interface GalleryDialogBoxProps {
  title: string;
  visualization: React.ReactNode;
  description: string | React.ReactNode;
  onPlay: () => void;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  ariaLabel: string;
}

export default function GalleryDialogBox({
  title,
  visualization,
  description,
  onPlay,
  onClose,
  onNext,
  onPrevious,
  ariaLabel,
}: GalleryDialogBoxProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const playButtonRef = useRef<HTMLButtonElement>(null);

  // Focus Play button after animation
  useEffect(() => {
    const timer = setTimeout(() => { playButtonRef.current?.focus(); }, 50);
    return () => { clearTimeout(timer); };
  }, []);

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape and arrow key handling
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onPrevious) onPrevious();
      if (e.key === 'ArrowRight' && onNext) onNext();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [onClose, onPrevious, onNext]);

  // Focus trap
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled])',
    );
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <div
        className={styles.overlay}
        aria-hidden="true"
        onClick={onClose}
        data-testid="gallery-overlay"
      />
      <div
        ref={dialogRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby="gallery-dialog-title"
        onKeyDown={handleKeyDown}
        data-testid="gallery-dialog"
      >
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close dialog"
        >
          &times;
        </button>

        <div className={styles.visualization}>{visualization}</div>

        <h2 id="gallery-dialog-title" className={styles.title}>{title}</h2>

        <div className={styles.description}>{description}</div>

        <div className={styles.navRow}>
          {onPrevious && (
            <button
              className={styles.navButton}
              onClick={onPrevious}
              aria-label="Previous item"
            >
              &larr; Prev
            </button>
          )}
          <button
            ref={playButtonRef}
            className={styles.playButton}
            onClick={onPlay}
            data-testid="gallery-play"
          >
            Play &#9654;
          </button>
          {onNext && (
            <button
              className={styles.navButton}
              onClick={onNext}
              aria-label="Next item"
            >
              Next &rarr;
            </button>
          )}
        </div>
      </div>
    </>
  );
}
