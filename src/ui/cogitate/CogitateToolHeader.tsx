/**
 * CogitateToolHeader — shared header used by all four Cogitate tools
 * (Replay, Analysis, Training, Free Play). Provides consistent back
 * navigation, optional "Cogitate home" link, and a centered title.
 *
 * Tools pass in their existing CSS module classes (backButton,
 * title, homeLink, headerClassName) so they can keep component-
 * specific visual tuning while inheriting shared JSX structure.
 */

import type { ReactNode } from 'react';

interface CogitateToolHeaderProps {
  readonly title: ReactNode;
  readonly onBack: () => void;
  readonly backLabel?: string;
  readonly backTestId?: string;
  readonly onHome?: () => void;
  readonly homeTestId?: string;
  readonly headerClassName?: string;
  readonly backButtonClassName?: string;
  readonly titleClassName?: string;
  readonly homeLinkClassName?: string;
}

export default function CogitateToolHeader({
  title,
  onBack,
  backLabel = 'Back',
  backTestId,
  onHome,
  homeTestId,
  headerClassName,
  backButtonClassName,
  titleClassName,
  homeLinkClassName,
}: CogitateToolHeaderProps) {
  return (
    <header className={headerClassName} data-testid="cogitate-tool-header">
      <button
        type="button"
        className={backButtonClassName}
        onClick={onBack}
        data-testid={backTestId}
      >
        {'\u2190 '}
        {backLabel}
      </button>
      <h2 className={titleClassName}>{title}</h2>
      {onHome && (
        <button
          type="button"
          className={homeLinkClassName}
          onClick={onHome}
          data-testid={homeTestId}
        >
          Cogitate
        </button>
      )}
    </header>
  );
}
