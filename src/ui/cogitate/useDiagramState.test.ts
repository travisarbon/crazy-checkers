import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDiagramState } from './useDiagramState';
import { square } from '../../engine/types';

describe('useDiagramState', () => {
  it('starts with empty overlays', () => {
    const { result } = renderHook(() => useDiagramState());
    expect(result.current.hasOverlays).toBe(false);
    expect(result.current.overlays.arrows).toHaveLength(0);
  });

  it('adds an arrow with the active color', () => {
    const { result } = renderHook(() => useDiagramState());
    act(() => { result.current.addArrow(square(11), square(15)); });
    expect(result.current.overlays.arrows).toHaveLength(1);
    expect(result.current.overlays.arrows[0]?.color).toBe('green');
  });

  it('toggles an arrow off when added twice with same color', () => {
    const { result } = renderHook(() => useDiagramState());
    act(() => { result.current.addArrow(square(11), square(15)); });
    act(() => { result.current.addArrow(square(11), square(15)); });
    expect(result.current.overlays.arrows).toHaveLength(0);
  });

  it('replaces an arrow when added again with a different color', () => {
    const { result } = renderHook(() => useDiagramState());
    act(() => { result.current.addArrow(square(11), square(15)); });
    act(() => { result.current.setActiveColor('red'); });
    act(() => { result.current.addArrow(square(11), square(15)); });
    expect(result.current.overlays.arrows).toHaveLength(1);
    expect(result.current.overlays.arrows[0]?.color).toBe('red');
  });

  it('removeArrow removes the matching arrow', () => {
    const { result } = renderHook(() => useDiagramState());
    act(() => { result.current.addArrow(square(11), square(15)); });
    act(() => { result.current.removeArrow(square(11), square(15)); });
    expect(result.current.overlays.arrows).toHaveLength(0);
  });

  it('toggleHighlight cycles through colors and off', () => {
    const { result } = renderHook(() => useDiagramState());
    act(() => { result.current.toggleHighlight(square(14)); });
    expect(result.current.overlays.highlights[0]?.color).toBe('green');
    act(() => { result.current.toggleHighlight(square(14)); });
    expect(result.current.overlays.highlights[0]?.color).toBe('red');
    act(() => { result.current.toggleHighlight(square(14)); });
    expect(result.current.overlays.highlights[0]?.color).toBe('blue');
    act(() => { result.current.toggleHighlight(square(14)); });
    expect(result.current.overlays.highlights).toHaveLength(0);
  });

  it('setAnnotation adds a truncated annotation', () => {
    const { result } = renderHook(() => useDiagramState());
    const text = 'a'.repeat(40);
    act(() => { result.current.setAnnotation(square(14), text); });
    expect(result.current.overlays.annotations[0]?.text.length).toBe(32);
  });

  it('setAnnotation with empty string removes the annotation', () => {
    const { result } = renderHook(() => useDiagramState());
    act(() => { result.current.setAnnotation(square(14), 'hi'); });
    act(() => { result.current.setAnnotation(square(14), '   '); });
    expect(result.current.overlays.annotations).toHaveLength(0);
  });

  it('removeAnnotation removes the annotation', () => {
    const { result } = renderHook(() => useDiagramState());
    act(() => { result.current.setAnnotation(square(14), 'hi'); });
    act(() => { result.current.removeAnnotation(square(14)); });
    expect(result.current.overlays.annotations).toHaveLength(0);
  });

  it('clearAll empties every overlay type', () => {
    const { result } = renderHook(() => useDiagramState());
    act(() => { result.current.addArrow(square(11), square(15)); });
    act(() => { result.current.toggleHighlight(square(14)); });
    act(() => { result.current.setAnnotation(square(18), 'hi'); });
    expect(result.current.hasOverlays).toBe(true);
    act(() => { result.current.clearAll(); });
    expect(result.current.hasOverlays).toBe(false);
  });

  it('setActiveTool and setActiveColor update state', () => {
    const { result } = renderHook(() => useDiagramState());
    act(() => { result.current.setActiveTool('arrow'); });
    expect(result.current.activeTool).toBe('arrow');
    act(() => { result.current.setActiveColor('blue'); });
    expect(result.current.activeColor).toBe('blue');
  });
});
