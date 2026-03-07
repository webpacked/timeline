/**
 * Phase R Step 3 — ToolRouter (adapter) + useToolRouter + virtual hooks
 *
 * Fixture: engine with 1 track, 2 clips.
 * Mock React.PointerEvent / React.KeyboardEvent with plain objects.
 */

import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  createTimeline,
  createTimelineState,
  createTrack,
  createClip,
  createAsset,
  toFrame,
  toTimecode,
  frameRate,
  toTrackId,
  toAssetId,
  NoOpTool,
} from '@timeline/core';
import type { VirtualWindow } from '@timeline/core';

import { TimelineEngine } from '../engine';
import { createToolRouter } from '../adapter/tool-router';
import { useToolRouter } from '../hooks/use-tool-router';
import { useVirtualWindow } from '../hooks/use-virtual-window';
import { useVisibleClips } from '../hooks/use-virtual-window';

// ── Fixture: 1 track, 2 clips ───────────────────────────────────────────────

function makeFixtureState() {
  const asset = createAsset({
    id: 'asset-1',
    name: 'Asset',
    mediaType: 'video',
    filePath: '/a.mp4',
    intrinsicDuration: toFrame(600),
    nativeFps: frameRate(30),
    sourceTimecodeOffset: toFrame(0),
  });
  const clipA = createClip({
    id: 'clip-a',
    assetId: asset.id,
    trackId: 'track-1',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(100),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });
  const clipB = createClip({
    id: 'clip-b',
    assetId: asset.id,
    trackId: 'track-1',
    timelineStart: toFrame(150),
    timelineEnd: toFrame(250),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });
  const track = createTrack({
    id: 'track-1',
    name: 'V1',
    type: 'video',
    clips: [clipA, clipB],
  });
  const timeline = createTimeline({
    id: 'tl-r3',
    name: 'R3',
    fps: frameRate(30),
    duration: toFrame(3000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [track],
  });
  return createTimelineState({
    timeline,
    assetRegistry: new Map([[asset.id, asset]]),
  });
}

let engine: TimelineEngine;
const ppf = 10;
let scrollLeft = 0;

function makeReactPointerEvent(overrides: Partial<{
  clientX: number;
  clientY: number;
  buttons: number;
  shiftKey: boolean;
  ctrlKey: boolean;
}> = {}): React.PointerEvent {
  return {
    clientX: overrides.clientX ?? 50,
    clientY: overrides.clientY ?? 24,
    buttons: overrides.buttons ?? 1,
    shiftKey: overrides.shiftKey ?? false,
    altKey: false,
    metaKey: false,
    ctrlKey: overrides.ctrlKey ?? false,
    preventDefault: vi.fn(),
    currentTarget: {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 400 }),
    },
  } as unknown as React.PointerEvent;
}

function makeReactKeyEvent(overrides: Partial<{
  key: string;
  code: string;
  shiftKey: boolean;
  preventDefault: () => void;
}> = {}): React.KeyboardEvent {
  return {
    key: overrides.key ?? 'x',
    code: overrides.code ?? 'KeyX',
    shiftKey: overrides.shiftKey ?? false,
    altKey: false,
    metaKey: false,
    ctrlKey: false,
    repeat: false,
    preventDefault: overrides.preventDefault ?? vi.fn(),
  } as unknown as React.KeyboardEvent;
}

beforeEach(() => {
  engine = new TimelineEngine({
    initialState: makeFixtureState(),
    tools: [NoOpTool],
    defaultToolId: 'noop',
  });
  scrollLeft = 0;
});

// ── createToolRouter ────────────────────────────────────────────────────────

describe('createToolRouter', () => {
  it('1. Returns object with 5 handlers', () => {
    const router = createToolRouter({
      engine,
      getPixelsPerFrame: () => ppf,
      getScrollLeft: () => scrollLeft,
    });
    expect(router).toHaveProperty('onPointerDown');
    expect(router).toHaveProperty('onPointerMove');
    expect(router).toHaveProperty('onPointerUp');
    expect(router).toHaveProperty('onPointerLeave');
    expect(router).toHaveProperty('onKeyDown');
    expect(typeof router.onPointerDown).toBe('function');
    expect(typeof router.onPointerMove).toBe('function');
    expect(typeof router.onPointerUp).toBe('function');
    expect(typeof router.onPointerLeave).toBe('function');
    expect(typeof router.onKeyDown).toBe('function');
  });

  it('2. onPointerDown calls engine.handlePointerDown', () => {
    const router = createToolRouter({ engine, getPixelsPerFrame: () => ppf });
    const spy = vi.spyOn(engine, 'handlePointerDown');
    const e = makeReactPointerEvent();
    router.onPointerDown(e);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toMatchObject({ frame: 5, x: 50, y: 24 });
  });

  it('3. onPointerUp calls engine.handlePointerUp', () => {
    const router = createToolRouter({ engine, getPixelsPerFrame: () => ppf });
    const spy = vi.spyOn(engine, 'handlePointerUp');
    router.onPointerUp(makeReactPointerEvent());
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('4. onPointerMove is rAF-throttled: 3 sync calls → 1 engine.handlePointerMove after flush', () => {
    const router = createToolRouter({ engine, getPixelsPerFrame: () => ppf });
    const spy = vi.spyOn(engine, 'handlePointerMove');
    let rafCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      rafCallback = null;
    });

    router.onPointerMove(makeReactPointerEvent({ clientX: 10 }));
    router.onPointerMove(makeReactPointerEvent({ clientX: 20 }));
    router.onPointerMove(makeReactPointerEvent({ clientX: 30 }));
    expect(spy).toHaveBeenCalledTimes(0);
    expect(rafCallback).not.toBeNull();
    rafCallback!(0);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0].x).toBe(30);

    vi.unstubAllGlobals();
  });

  it('5. onPointerLeave calls engine.handlePointerUp AND engine.handlePointerLeave', () => {
    const router = createToolRouter({ engine, getPixelsPerFrame: () => ppf });
    const upSpy = vi.spyOn(engine, 'handlePointerUp');
    const leaveSpy = vi.spyOn(engine, 'handlePointerLeave');
    router.onPointerLeave(makeReactPointerEvent());
    expect(upSpy).toHaveBeenCalledTimes(1);
    expect(leaveSpy).toHaveBeenCalledTimes(1);
  });

  it('6. onKeyDown calls engine.handleKeyDown', () => {
    const router = createToolRouter({ engine, getPixelsPerFrame: () => ppf });
    const spy = vi.spyOn(engine, 'handleKeyDown');
    router.onKeyDown(makeReactKeyEvent({ key: 'z', code: 'KeyZ' }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('7. onKeyDown calls e.preventDefault() when handler returns true', () => {
    const router = createToolRouter({ engine, getPixelsPerFrame: () => ppf });
    const e = makeReactKeyEvent({ key: ' ', code: 'Space' });
    vi.spyOn(engine, 'handleKeyDown').mockReturnValue(true);
    router.onKeyDown(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('8. onKeyDown does NOT call e.preventDefault() when handler returns false', () => {
    const router = createToolRouter({ engine, getPixelsPerFrame: () => ppf });
    const e = makeReactKeyEvent({ key: 'z' });
    vi.spyOn(engine, 'handleKeyDown').mockReturnValue(false);
    router.onKeyDown(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('9. convertPointerEvent includes scrollLeft offset in x coordinate', () => {
    scrollLeft = 100;
    const router = createToolRouter({
      engine,
      getPixelsPerFrame: () => ppf,
      getScrollLeft: () => scrollLeft,
    });
    const spy = vi.spyOn(engine, 'handlePointerDown');
    const e = makeReactPointerEvent({ clientX: 50 });
    router.onPointerDown(e);
    expect(spy.mock.calls[0]![0].x).toBe(150);
    expect(spy.mock.calls[0]![0].frame).toBe(15);
  });

  it('10. Modifiers (shiftKey, ctrlKey) passed through', () => {
    const router = createToolRouter({ engine, getPixelsPerFrame: () => ppf });
    const spy = vi.spyOn(engine, 'handlePointerDown');
    router.onPointerDown(
      makeReactPointerEvent({ shiftKey: true, ctrlKey: true }),
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![1]).toEqual({
      shift: true,
      alt: false,
      ctrl: true,
      meta: false,
    });
  });
});

// ── useToolRouter ──────────────────────────────────────────────────────────

describe('useToolRouter', () => {
  it('11. Returns stable handlers reference across re-renders (same engine)', () => {
    const { result, rerender } = renderHook(
      () =>
        useToolRouter(engine, {
          getPixelsPerFrame: () => ppf,
        }),
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('12. Returns new handlers if engine changes', () => {
    const engine2 = new TimelineEngine({
      initialState: makeFixtureState(),
      tools: [NoOpTool],
      defaultToolId: 'noop',
    });
    const { result, rerender } = renderHook(
      ({ eng }) =>
        useToolRouter(eng, { getPixelsPerFrame: () => ppf }),
      { initialProps: { eng: engine } },
    );
    const first = result.current;
    rerender({ eng: engine2 });
    expect(result.current).not.toBe(first);
  });
});

// ── useVirtualWindow ────────────────────────────────────────────────────────

describe('useVirtualWindow', () => {
  it('13. Returns correct startFrame and endFrame for given viewport/scroll/ppf', () => {
    const { result } = renderHook(() =>
      useVirtualWindow(engine, 100, 0, 10),
    );
    expect(result.current.startFrame).toBe(0);
    expect(result.current.endFrame).toBe(10);
    expect(result.current.pixelsPerFrame).toBe(10);
  });

  it('14. Returns new window when scrollLeft changes', () => {
    const { result, rerender } = renderHook(
      ({ scroll }: { scroll: number }) =>
        useVirtualWindow(engine, 100, scroll, 10),
      { initialProps: { scroll: 0 } },
    );
    const w0 = result.current;
    rerender({ scroll: 50 });
    expect(result.current).not.toBe(w0);
    expect(result.current.startFrame).toBe(5);
  });

  it('15. Returns same reference when nothing changes', () => {
    const { result, rerender } = renderHook(() =>
      useVirtualWindow(engine, 100, 0, 10),
    );
    const w0 = result.current;
    rerender();
    expect(result.current).toBe(w0);
  });
});

// ── useVisibleClips ─────────────────────────────────────────────────────────

describe('useVisibleClips', () => {
  it('16. Returns only visible clips for current window', () => {
    const window: VirtualWindow = {
      startFrame: toFrame(0),
      endFrame: toFrame(200),
      pixelsPerFrame: 10,
    };
    const { result } = renderHook(() => useVisibleClips(engine, window));
    const entries = result.current;
    expect(entries.length).toBeGreaterThanOrEqual(2);
    const visible = entries.filter((e) => e.isVisible);
    expect(visible.length).toBe(2);
  });

  it('17. Updates when engine state changes (new clip added inside window)', () => {
    const window: VirtualWindow = {
      startFrame: toFrame(0),
      endFrame: toFrame(500),
      pixelsPerFrame: 10,
    };
    const { result } = renderHook(() => useVisibleClips(engine, window));
    const countBefore = result.current.filter((e) => e.isVisible).length;
    const newClip = createClip({
      id: 'clip-c',
      assetId: 'asset-1',
      trackId: 'track-1',
      timelineStart: toFrame(100),
      timelineEnd: toFrame(150),
      mediaIn: toFrame(0),
      mediaOut: toFrame(50),
    });
    let dispatched: { accepted: boolean };
    act(() => {
      dispatched = engine.dispatch({
        id: 'add',
        label: 'Add clip',
        timestamp: 0,
        operations: [
          { type: 'INSERT_CLIP', trackId: toTrackId('track-1'), clip: newClip },
        ],
      });
    });
    expect(dispatched!.accepted).toBe(true);
    const countAfter = result.current.filter((e) => e.isVisible).length;
    expect(countAfter).toBe(countBefore + 1);
  });

  it('18. isVisible false for clips outside window', () => {
    const window: VirtualWindow = {
      startFrame: toFrame(1000),
      endFrame: toFrame(1100),
      pixelsPerFrame: 10,
    };
    const { result } = renderHook(() => useVisibleClips(engine, window));
    const entries = result.current;
    const visible = entries.filter((e) => e.isVisible);
    expect(visible.length).toBe(0);
  });
});
