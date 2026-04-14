/**
 * PositionEditor — piece palette, side-to-move toggle, validation display,
 * and editor action buttons for the Free Play tool (Task 21.5).
 *
 * The actual board is rendered by the parent FreePlayTool via CogitateBoard
 * in editor mode; this component only owns the surrounding controls.
 */

import { memo } from 'react';
import type { PieceColor } from '../../engine/types';
import { PieceColor as PieceColors, PieceType } from '../../engine/types';
import type { PieceDefinition, ValidationResult } from '../../cogitate/types';
import { useToolbarNavigation } from '../hooks/useToolbarNavigation';
import styles from './PositionEditor.module.css';

export interface PositionEditorProps {
  readonly piecePalette: readonly PieceDefinition[];
  readonly selectedPiece: PieceDefinition | null;
  readonly onPieceSelect: (piece: PieceDefinition | null) => void;
  readonly sideToMove: PieceColor;
  readonly onSideToMoveChange: (color: PieceColor) => void;
  readonly validation: ValidationResult;
  readonly onClearBoard: () => void;
  readonly onStandardSetup: () => void;
  readonly onLoadPosition: () => void;
  readonly className?: string;
}

/** Mini crown matching the SVG on the real board (see Piece.tsx). */
function CrownMark() {
  return (
    <svg
      viewBox="-16 -16 32 32"
      width="1.4rem"
      height="1.4rem"
      aria-hidden="true"
      focusable={false}
    >
      <path
        d="M -12,6 L -8,-6 L -4,2 L 0,-6 L 4,2 L 8,-6 L 12,6 Z"
        transform="translate(0, 4)"
        fill="var(--ui-accent)"
      />
    </svg>
  );
}

function PieceIcon({ piece }: { readonly piece: PieceDefinition }) {
  const classes = [
    styles.pieceIcon,
    piece.color === PieceColors.White ? styles.pieceWhite : styles.pieceBlack,
  ].join(' ');
  return (
    <span className={classes} aria-hidden="true">
      {piece.type === PieceType.King ? <CrownMark /> : null}
    </span>
  );
}

function PositionEditor({
  piecePalette,
  selectedPiece,
  onPieceSelect,
  sideToMove,
  onSideToMoveChange,
  validation,
  onClearBoard,
  onStandardSetup,
  onLoadPosition,
  className,
}: PositionEditorProps) {
  const rootClass = [styles.root, className ?? ''].filter(Boolean).join(' ');
  const { setContainer: paletteRef, onKeyDown: paletteKeyDown } =
    useToolbarNavigation<HTMLDivElement>();
  const { setContainer: sideToMoveRef, onKeyDown: sideToMoveKeyDown } =
    useToolbarNavigation<HTMLDivElement>();

  const validationTone = !validation.isLegal
    ? styles.validationError
    : validation.warnings.length > 0
      ? styles.validationWarn
      : styles.validationOk;

  return (
    <div className={rootClass} data-testid="position-editor">
      <div>
        <h3 className={styles.sectionTitle}>Piece palette</h3>
        <div
          className={styles.palette}
          role="radiogroup"
          aria-label="Piece palette"
          data-testid="position-editor-palette"
          ref={paletteRef}
          onKeyDown={paletteKeyDown}
        >
          {piecePalette.map((piece, index) => {
            const isActive =
              selectedPiece !== null &&
              selectedPiece.color === piece.color &&
              selectedPiece.type === piece.type;
            // Roving tabindex: active if selected, else first item gets tabIndex 0 when
            // nothing is selected so keyboard users can enter the group.
            const hasActive = selectedPiece !== null;
            const isFirst = index === 0;
            const tabIndex = isActive || (!hasActive && isFirst) ? 0 : -1;
            const classes = [
              styles.paletteItem,
              isActive ? styles.paletteItemActive : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={piece.renderKey}
                type="button"
                role="radio"
                aria-checked={isActive}
                tabIndex={tabIndex}
                className={classes}
                onClick={() => {
                  onPieceSelect(isActive ? null : piece);
                }}
                data-testid={`palette-${piece.renderKey}`}
              >
                <PieceIcon piece={piece} />
                <span>{piece.displayName}</span>
              </button>
            );
          })}
        </div>
        <p className={styles.selectedLabel} data-testid="selected-piece-label">
          {selectedPiece
            ? `Selected: ${selectedPiece.displayName}`
            : 'Cycle / remove mode (click a piece on the board)'}
        </p>
      </div>

      <div className={styles.sideToMove}>
        <h3 className={styles.sectionTitle}>Side to move</h3>
        <div
          className={styles.sideToMoveRadios}
          role="radiogroup"
          aria-label="Side to move"
          ref={sideToMoveRef}
          onKeyDown={sideToMoveKeyDown}
        >
          <button
            type="button"
            role="radio"
            aria-checked={sideToMove === PieceColors.White}
            tabIndex={sideToMove === PieceColors.White ? 0 : -1}
            className={[
              styles.sideRadio,
              sideToMove === PieceColors.White ? styles.sideRadioActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => { onSideToMoveChange(PieceColors.White); }}
            data-testid="side-to-move-white"
          >
            White
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={sideToMove === PieceColors.Black}
            tabIndex={sideToMove === PieceColors.Black ? 0 : -1}
            className={[
              styles.sideRadio,
              sideToMove === PieceColors.Black ? styles.sideRadioActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => { onSideToMoveChange(PieceColors.Black); }}
            data-testid="side-to-move-black"
          >
            Black
          </button>
        </div>
      </div>

      <div
        className={[styles.validation, validationTone].filter(Boolean).join(' ')}
        data-testid="position-editor-validation"
      >
        <strong>
          {!validation.isLegal
            ? 'Position has issues'
            : validation.warnings.length > 0
              ? 'Position is legal (with warnings)'
              : 'Position is legal'}
        </strong>
        {validation.errors.length > 0 && (
          <ul className={styles.validationList} data-testid="validation-errors">
            {validation.errors.map((err, i) => (
              <li key={`err-${String(i)}`}>{err}</li>
            ))}
          </ul>
        )}
        {validation.warnings.length > 0 && (
          <ul className={styles.validationList} data-testid="validation-warnings">
            {validation.warnings.map((w, i) => (
              <li key={`warn-${String(i)}`}>{w}</li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.actions} role="group" aria-label="Editor actions">
        <button
          type="button"
          className={styles.actionButton}
          onClick={onClearBoard}
          data-testid="editor-clear-board"
        >
          Clear Board
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={onStandardSetup}
          data-testid="editor-standard-setup"
        >
          Standard Setup
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={onLoadPosition}
          data-testid="editor-load-position"
        >
          Load Position
        </button>
      </div>
    </div>
  );
}

export default memo(PositionEditor);
