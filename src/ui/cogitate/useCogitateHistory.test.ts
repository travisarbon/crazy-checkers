import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCogitateHistory, type CogitateView } from './useCogitateHistory';

describe('useCogitateHistory', () => {
  let pushStateSpy: ReturnType<typeof vi.fn>;
  let backSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pushStateSpy = vi
      .spyOn(window.history, 'pushState')
      .mockImplementation(() => undefined);
    backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
  });

  afterEach(() => {
    pushStateSpy.mockRestore();
    backSpy.mockRestore();
  });

  function renderWith(initial: CogitateView) {
    let currentView = initial;
    const setView = vi.fn((v: CogitateView) => {
      currentView = v;
    });
    const hook = renderHook(
      ({ view }: { view: CogitateView }) => {
        useCogitateHistory({ view, setView });
      },
      { initialProps: { view: initial } },
    );
    return { hook, setView, getView: () => currentView };
  }

  it('pushes a history entry when navigating home → tool', () => {
    const { hook } = renderWith({ kind: 'cogitate-home' });
    expect(pushStateSpy).not.toHaveBeenCalled();
    hook.rerender({ view: { kind: 'cogitate-replay' } });
    expect(pushStateSpy).toHaveBeenCalledTimes(1);
    const firstCall = pushStateSpy.mock.calls[0];
    if (!firstCall) throw new Error('pushState not called');
    const entry = firstCall[0] as {
      screenKind: string;
      cogitateView: string;
      parentKind: string;
    };
    expect(entry.screenKind).toBe('cogitate');
    expect(entry.cogitateView).toBe('cogitate-replay');
    expect(entry.parentKind).toBe('cogitate');
  });

  it('calls history.back() when navigating tool → home', () => {
    const { hook } = renderWith({ kind: 'cogitate-home' });
    hook.rerender({ view: { kind: 'cogitate-analysis' } });
    expect(pushStateSpy).toHaveBeenCalledTimes(1);
    hook.rerender({ view: { kind: 'cogitate-home' } });
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('restores view on popstate to a cogitate-tool entry', () => {
    const { hook, setView } = renderWith({ kind: 'cogitate-home' });
    hook.rerender({ view: { kind: 'cogitate-home' } });

    const event = new PopStateEvent('popstate', {
      state: {
        screenKind: 'cogitate',
        cogitateView: 'cogitate-training',
        parentKind: 'cogitate',
      },
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(setView).toHaveBeenCalledWith({ kind: 'cogitate-training' });
  });

  it('pops back to home when popstate targets the cogitate home entry from a tool', () => {
    const { hook, setView } = renderWith({ kind: 'cogitate-home' });
    hook.rerender({ view: { kind: 'cogitate-freeplay' } });

    const event = new PopStateEvent('popstate', {
      state: {
        screenKind: 'cogitate',
        parentKind: 'menu',
      },
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(setView).toHaveBeenCalledWith({ kind: 'cogitate-home' });
  });

  it('ignores popstate events for non-cogitate screens', () => {
    const { setView } = renderWith({ kind: 'cogitate-home' });
    const event = new PopStateEvent('popstate', {
      state: { screenKind: 'menu' },
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(setView).not.toHaveBeenCalled();
  });

  it('does not call setView when popping on the home view (lets App.tsx handle)', () => {
    const { setView } = renderWith({ kind: 'cogitate-home' });
    const event = new PopStateEvent('popstate', {
      state: { screenKind: 'cogitate', parentKind: 'menu' },
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(setView).not.toHaveBeenCalled();
  });
});
