import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  usePreviewMode,
  PREVIEW_MAX_SIZE,
  PREVIEW_MIN_SIZE,
  PREVIEW_SATURATION,
} from './usePreviewMode';

describe('usePreviewMode', () => {
  it('clamps preview size to [200,280]', () => {
    expect(renderHook(() => usePreviewMode('preview', 1000)).result.current.size).toBe(
      PREVIEW_MAX_SIZE,
    );
    expect(renderHook(() => usePreviewMode('preview', 50)).result.current.size).toBe(
      PREVIEW_MIN_SIZE,
    );
  });

  it('disables interactivity + animation in preview', () => {
    const { result } = renderHook(() => usePreviewMode('preview'));
    expect(result.current.interactive).toBe(false);
    expect(result.current.animate).toBe(false);
    expect(result.current.tabbable).toBe(false);
    expect(result.current.saturation).toBe(PREVIEW_SATURATION);
  });

  it('enables interactivity in interactive mode', () => {
    const { result } = renderHook(() => usePreviewMode('interactive', 700));
    expect(result.current.interactive).toBe(true);
    expect(result.current.animate).toBe(true);
    expect(result.current.tabbable).toBe(true);
    expect(result.current.size).toBe(700);
  });

  it('suppresses interactivity but keeps sizing in replay', () => {
    const { result } = renderHook(() => usePreviewMode('replay', 500));
    expect(result.current.interactive).toBe(false);
    expect(result.current.animate).toBe(false);
    expect(result.current.tabbable).toBe(false);
  });
});
