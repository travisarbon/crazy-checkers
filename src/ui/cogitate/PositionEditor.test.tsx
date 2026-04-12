import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PositionEditor from './PositionEditor';
import { PieceColor, PieceType } from '../../engine/types';
import type { PieceDefinition, ValidationResult } from '../../cogitate/types';

const PALETTE: readonly PieceDefinition[] = [
  { color: PieceColor.White, type: PieceType.Pawn, displayName: 'White Pawn', renderKey: 'white-pawn' },
  { color: PieceColor.White, type: PieceType.King, displayName: 'White King', renderKey: 'white-king' },
  { color: PieceColor.Black, type: PieceType.Pawn, displayName: 'Black Pawn', renderKey: 'black-pawn' },
  { color: PieceColor.Black, type: PieceType.King, displayName: 'Black King', renderKey: 'black-king' },
];

const LEGAL: ValidationResult = { isLegal: true, errors: [], warnings: [] };

function renderEditor(overrides: Partial<React.ComponentProps<typeof PositionEditor>> = {}) {
  const props: React.ComponentProps<typeof PositionEditor> = {
    piecePalette: PALETTE,
    selectedPiece: null,
    onPieceSelect: vi.fn(),
    sideToMove: PieceColor.White,
    onSideToMoveChange: vi.fn(),
    validation: LEGAL,
    onClearBoard: vi.fn(),
    onStandardSetup: vi.fn(),
    onLoadPosition: vi.fn(),
    ...overrides,
  };
  render(<PositionEditor {...props} />);
  return props;
}

describe('PositionEditor', () => {
  it('renders all palette pieces', () => {
    renderEditor();
    for (const p of PALETTE) {
      expect(screen.getByTestId(`palette-${p.renderKey}`)).toBeInTheDocument();
    }
  });

  it('fires onPieceSelect when a palette piece is clicked', () => {
    const props = renderEditor();
    fireEvent.click(screen.getByTestId('palette-white-king'));
    expect(props.onPieceSelect).toHaveBeenCalledTimes(1);
    const call = (props.onPieceSelect as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call?.[0]).toMatchObject({ color: PieceColor.White, type: PieceType.King });
  });

  it('fires onPieceSelect with null when clicking the currently selected piece', () => {
    const props = renderEditor({ selectedPiece: PALETTE[1] });
    fireEvent.click(screen.getByTestId('palette-white-king'));
    const call = (props.onPieceSelect as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call?.[0]).toBeNull();
  });

  it('shows the selected piece label', () => {
    renderEditor({ selectedPiece: PALETTE[0] });
    expect(screen.getByTestId('selected-piece-label').textContent).toContain('White Pawn');
  });

  it('fires onSideToMoveChange when toggle is clicked', () => {
    const props = renderEditor();
    fireEvent.click(screen.getByTestId('side-to-move-black'));
    expect(props.onSideToMoveChange).toHaveBeenCalledWith(PieceColor.Black);
  });

  it('renders legal validation with no list items', () => {
    renderEditor();
    expect(screen.getByTestId('position-editor-validation').textContent).toContain('legal');
    expect(screen.queryByTestId('validation-errors')).toBeNull();
    expect(screen.queryByTestId('validation-warnings')).toBeNull();
  });

  it('renders warnings with amber tone', () => {
    renderEditor({
      validation: { isLegal: true, errors: [], warnings: ['Pawn on promotion row'] },
    });
    expect(screen.getByTestId('validation-warnings').textContent).toContain('Pawn on promotion row');
  });

  it('renders errors when illegal', () => {
    renderEditor({
      validation: { isLegal: false, errors: ['Too many White pieces'], warnings: [] },
    });
    expect(screen.getByTestId('validation-errors').textContent).toContain('Too many White pieces');
  });

  it('fires action callbacks', () => {
    const props = renderEditor();
    fireEvent.click(screen.getByTestId('editor-clear-board'));
    fireEvent.click(screen.getByTestId('editor-standard-setup'));
    fireEvent.click(screen.getByTestId('editor-load-position'));
    expect(props.onClearBoard).toHaveBeenCalledTimes(1);
    expect(props.onStandardSetup).toHaveBeenCalledTimes(1);
    expect(props.onLoadPosition).toHaveBeenCalledTimes(1);
  });
});
