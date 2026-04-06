/**
 * Collapsible disclosure widget for detail content.
 * Implements the ARIA disclosure pattern with CSS grid animation.
 */

import { useState, useId } from 'react';
import styles from './ExpandableDetailPanel.module.css';

export interface ExpandableDetailPanelProps {
  title: string;
  summary?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  ariaLabel?: string;
}

export default function ExpandableDetailPanel({
  title,
  summary,
  children,
  defaultExpanded = false,
  ariaLabel,
}: ExpandableDetailPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();

  function handleToggle() {
    setExpanded((prev) => !prev);
  }

  return (
    <div className={styles.panel} data-testid="expandable-panel">
      <button
        className={styles.toggleButton}
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={ariaLabel ?? title}
      >
        <span>{title}</span>
        <span
          className={[styles.chevron, expanded ? styles.chevronExpanded : ''].filter(Boolean).join(' ')}
          aria-hidden="true"
        >
          ▸
        </span>
      </button>

      {!expanded && summary && (
        <p className={styles.summary}>{summary}</p>
      )}

      <div
        className={[styles.contentWrapper, expanded ? styles.contentWrapperExpanded : ''].filter(Boolean).join(' ')}
        id={panelId}
        role="region"
        aria-hidden={!expanded}
      >
        <div className={styles.contentInner}>
          <div className={styles.contentBody}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
