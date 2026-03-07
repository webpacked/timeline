/**
 * tool-router.test.ts
 *
 * Tests for createToolRouter() and its coordinate conversion utilities.
 *
 * KEY TESTS:
 *   - onPointerMove is rAF-throttled: multiple rapid calls → one engine call
 *   - onPointerLeave resets rAF state AND calls handlePointerUp (Option Y)
 *   - Coordinate conversion: frameAtX, trackAtY, clipAtFrame
 *   - Handlers are synchronous for down/up, deferred for move
 *
 * VITEST FAKE TIMERS:
 *   We use vi.useFakeTimers() to control requestAnimationFrame.
 *   flushRaf() flushes pending rAF callbacks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createToolRouter,
  frameAtX,
  trackAtY,
  clipAtFrame,
  extractModifiers,
} from '../tool-router';
import type { TrackLayout, RouterLayout } from '../tool-router';

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
  toClipId,
  toAssetId,
} from '@webpacked-timeline/core';
import type { TimelinePointerEvent, TimelineKeyEvent, Modifiers } from '@webpacked-timeline/core';

import { TimelineEngine } from '../index';

// ── Fixtures ────────────────────────────────────────────────────────────────

const ASSET_ID  = toAssetId('asset-1');
const TRACK_ID  = toTrackId('track-1');
const CLIP_A_ID = toClipId('clip-a');

function makeState() {
  const asset = createAsset({
    id:                   'asset-1',
    name:                 'Test Asset',
    mediaType:            'video',
    filePath:             '/media/test.mp4',
    intrinsicDuration:    toFrame(600),
    nativeFps:            30,
    sourceTimecodeOffset: toFrame(0),
    status:               'online',
  });

  const clipA = createClip({
    id:            'clip-a',
    assetId:       'asset-1',
    trackId:       'track-1',
    timelineStart: toFrame(0),
    timelineEnd:   toFrame(100),
    mediaIn:       toFrame(0),
    mediaOut:      toFrame(100),
  });

  const track = createTrack({
    id:    'track-1',
    name:  'Video 1',
    type:  'video',
    clips: [clipA],
  });

  const timeline = createTimeline({
    id:            'tl-router-test',
    name:          'Router Test Timeline',
    fps:           frameRate(30),
    duration:      toFrame(9000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks:        [track],
  });

  return createTimelineState({
    timeline,
    assetRegistry: new Map([[ASSET_ID, asset]]),
  });
}

/** Minimal PointerEvent-like object for tests */
function makePointerEvent(overrides: Partial<{
  clientX: number;
  clientY: number;
  buttons: number;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}> = {}): PointerEvent {
  return {
    clientX:  overrides.clientX  ?? 100,
    clientY:  overrides.clientY  ?? 24,
    buttons:  overrides.buttons  ?? 1,
    shiftKey: overrides.shiftKey ?? false,
    altKey:   overrides.altKey   ?? false,
    ctrlKey:  overrides.ctrlKey  ?? false,
    metaKey:  overrides.metaKey  ?? false,
  } as unknown as PointerEvent;
}

/** Minimal KeyboardEvent-like object for tests */
function makeKeyEvent(key: string, overrides: Partial<{
  code: string;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}> = {}): KeyboardEvent {
  return {
    key,
    code:     overrides.code     ?? `Key${key.toUpperCase()}`,
    shiftKey: overrides.shiftKey ?? false,
    altKey:   overrides.altKey   ?? false,
    metaKey:  overrides.metaKey  ?? false,
    ctrlKey:  overrides.ctrlKey  ?? false,
  } as unknown as KeyboardEvent;
}

/** Standard RouterLayout used in most tests: origin=0, ppf=10, one 48px track */
const DEFAULT_TRACK_LAYOUTS: TrackLayout[] = [
  { trackId: TRACK_ID, top: 0, height: 48 },
];

const DEFAULT_LAYOUT: RouterLayout = {
  timelineOriginX: 0,
  pixelsPerFrame:  10,
  trackLayouts:    DEFAULT_TRACK_LAYOUTS,
};

// ── UNIT TESTS: coordinate conversion ──────────────────────────────────────

describe('frameAtX', () => {
  it('converts clientX to frame at ppf=10, origin=0', () => {
    expect(frameAtX(100, 0, 10)).toBe(10);
    expect(frameAtX(0,   0, 10)).toBe(0);
    expect(frameAtX(99,  0, 10)).toBe(9);   // floor: 9.9 → 9
  });

  it('accounts for non-zero timelineOriginX', () => {
    expect(frameAtX(200, 100, 10)).toBe(10);  // (200-100)/10 = 10
    expect(frameAtX(100, 100, 10)).toBe(0);
  });

  it('negative clientX before origin → negative frame (clamping is caller responsibility)', () => {
    expect(frameAtX(0, 50, 10)).toBe(-5);  // (0-50)/10 = -5
  });
});

describe('trackAtY', () => {
  const layouts: TrackLayout[] = [
    { trackId: toTrackId('t1'), top: 0,   height: 48 },
    { trackId: toTrackId('t2'), top: 48,  height: 48 },
    { trackId: toTrackId('t3'), top: 96,  height: 32 },
  ];

  it('returns track containing clientY', () => {
    expect(trackAtY(0,   layouts)).toBe(toTrackId('t1'));
    expect(trackAtY(47,  layouts)).toBe(toTrackId('t1'));
    expect(trackAtY(48,  layouts)).toBe(toTrackId('t2'));
    expect(trackAtY(96,  layouts)).toBe(toTrackId('t3'));
    expect(trackAtY(127, layouts)).toBe(toTrackId('t3'));
  });

  it('returns null when below all tracks', () => {
    expect(trackAtY(200, layouts)).toBeNull();
  });

  it('returns null for empty layout', () => {
    expect(trackAtY(50, [])).toBeNull();
  });

  it('top boundary is inclusive, bottom boundary is exclusive', () => {
    expect(trackAtY(48, layouts)).toBe(toTrackId('t2'));   // exactly at t2 top
    expect(trackAtY(47, layouts)).toBe(toTrackId('t1'));   // last px of t1
  });
});

describe('clipAtFrame', () => {
  const state = makeState();

  it('returns clipId when frame is within clip bounds', () => {
    // clip-a: [0, 100)
    expect(clipAtFrame(toFrame(0),  TRACK_ID, state)).toBe(CLIP_A_ID);
    expect(clipAtFrame(toFrame(99), TRACK_ID, state)).toBe(CLIP_A_ID);
  });

  it('returns null at timelineEnd (exclusive bound)', () => {
    expect(clipAtFrame(toFrame(100), TRACK_ID, state)).toBeNull();
  });

  it('returns null when trackId is null', () => {
    expect(clipAtFrame(toFrame(50), null, state)).toBeNull();
  });

  it('returns null for unknown trackId', () => {
    expect(clipAtFrame(toFrame(50), toTrackId('ghost'), state)).toBeNull();
  });

  it('returns null in gap between clips', () => {
    expect(clipAtFrame(toFrame(150), TRACK_ID, state)).toBeNull();
  });
});

describe('extractModifiers', () => {
  it('extracts all modifier keys from a PointerEvent', () => {
    const e = makePointerEvent({ shiftKey: true, altKey: false, ctrlKey: true, metaKey: false });
    expect(extractModifiers(e)).toEqual({ shift: true, alt: false, ctrl: true, meta: false });
  });

  it('extracts all modifiers false when none held', () => {
    expect(extractModifiers(makePointerEvent())).toEqual({
      shift: false, alt: false, ctrl: false, meta: false,
    });
  });
});

// ── INTEGRATION TESTS: createToolRouter ────────────────────────────────────

/**
 * requestAnimationFrame stub.
 * Captures pending callbacks and lets tests flush them via flushRaf().
 * Vitest's flushRaf() does not flush rAF in jsdom — this is the
 * standard workaround.
 */
let rafCallbacks: FrameRequestCallback[] = [];

function flushRaf(): void {
  const callbacks = rafCallbacks.slice();
  rafCallbacks = [];
  for (const cb of callbacks) cb(performance.now());
}

describe('createToolRouter', () => {
  let engine: TimelineEngine;
  let router: ReturnType<typeof createToolRouter>;

  beforeEach(() => {
    // Stub rAF to capture callbacks synchronously
    rafCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });

    engine = new TimelineEngine({ initialState: makeState() });
    router = createToolRouter(engine, () => DEFAULT_LAYOUT);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    rafCallbacks = [];
  });

  // ── onPointerDown ─────────────────────────────────────────────────────────

  describe('onPointerDown', () => {
    it('calls engine.handlePointerDown() synchronously', () => {
      const spy = vi.spyOn(engine, 'handlePointerDown');
      router.onPointerDown(makePointerEvent({ clientX: 50, clientY: 24 }));
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('passes correct TimelinePointerEvent (frame derived from clientX, trackId from clientY)', () => {
      const spy = vi.spyOn(engine, 'handlePointerDown');
      // clientX=50, ppf=10, origin=0 → frame 5. clientY=24 → track-1 (0-48)
      router.onPointerDown(makePointerEvent({ clientX: 50, clientY: 24 }));
      const evt = spy.mock.calls[0]![0] as TimelinePointerEvent;
      expect(evt.frame).toBe(toFrame(5));
      expect(evt.trackId).toBe(TRACK_ID);
    });

    it('populates clipId via hit-test (cursor over clip-a at frame 5)', () => {
      const spy = vi.spyOn(engine, 'handlePointerDown');
      router.onPointerDown(makePointerEvent({ clientX: 50, clientY: 24 }));  // frame 5
      const evt = spy.mock.calls[0]![0] as TimelinePointerEvent;
      expect(evt.clipId).toBe(CLIP_A_ID);
    });

    it('populates clipId as null when cursor is in a gap (frame 150)', () => {
      const spy = vi.spyOn(engine, 'handlePointerDown');
      router.onPointerDown(makePointerEvent({ clientX: 1500, clientY: 24 }));  // frame 150
      const evt = spy.mock.calls[0]![0] as TimelinePointerEvent;
      expect(evt.clipId).toBeNull();
    });
  });

  // ── onPointerMove (rAF throttle) ──────────────────────────────────────────

  describe('onPointerMove — rAF throttle', () => {
    it('does NOT call engine.handlePointerMove() synchronously', () => {
      const spy = vi.spyOn(engine, 'handlePointerMove');
      router.onPointerMove(makePointerEvent());
      expect(spy).toHaveBeenCalledTimes(0);  // deferred to rAF
    });

    it('calls engine.handlePointerMove() exactly once after rAF flushes', () => {
      const spy = vi.spyOn(engine, 'handlePointerMove');
      router.onPointerMove(makePointerEvent({ clientX: 100 }));
      flushRaf();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('coalesces multiple rapid moves into one engine call (rAF throttle)', () => {
      const spy = vi.spyOn(engine, 'handlePointerMove');
      // 10 rapid move events before the rAF fires
      for (let i = 0; i < 10; i++) {
        router.onPointerMove(makePointerEvent({ clientX: i * 10 }));
      }
      flushRaf();
      // Only ONE engine call — rAF coalesced all intermediate events
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('uses the MOST RECENT event, not the first (coalescing semantics)', () => {
      const spy = vi.spyOn(engine, 'handlePointerMove');
      router.onPointerMove(makePointerEvent({ clientX: 10  }));  // frame 1
      router.onPointerMove(makePointerEvent({ clientX: 200 }));  // frame 20 — this wins
      router.onPointerMove(makePointerEvent({ clientX: 500 }));  // frame 50 — this wins
      flushRaf();
      const evt = spy.mock.calls[0]![0] as TimelinePointerEvent;
      // clientX=500, ppf=10, origin=0 → frame 50
      expect(evt.frame).toBe(toFrame(50));
    });

    it('allows a second rAF after the first fires (reset)', () => {
      const spy = vi.spyOn(engine, 'handlePointerMove');
      router.onPointerMove(makePointerEvent({ clientX: 100 }));
      flushRaf();  // first rAF fires
      router.onPointerMove(makePointerEvent({ clientX: 200 }));
      flushRaf();  // second rAF fires
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  // ── onPointerUp ───────────────────────────────────────────────────────────

  describe('onPointerUp', () => {
    it('calls engine.handlePointerUp() synchronously', () => {
      const spy = vi.spyOn(engine, 'handlePointerUp');
      router.onPointerUp(makePointerEvent());
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  // ── onPointerLeave (Option Y) ─────────────────────────────────────────────

  describe('onPointerLeave — Option Y', () => {
    it('calls engine.handlePointerUp() to clear provisional state', () => {
      const spy = vi.spyOn(engine, 'handlePointerUp');
      router.onPointerLeave(makePointerEvent());
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('cancels the pending rAF — the queued callback becomes a no-op', () => {
      const spy = vi.spyOn(engine, 'handlePointerMove');
      // Schedule a rAF by calling move
      router.onPointerMove(makePointerEvent({ clientX: 100 }));
      // Leave before rAF fires
      router.onPointerLeave(makePointerEvent({ clientX: 200 }));
      // Flush rAF — should be a no-op because lastMoveEvent was nulled
      flushRaf();
      expect(spy).toHaveBeenCalledTimes(0);
    });

    it('resets rAF state so next move starts clean', () => {
      const moveSpy = vi.spyOn(engine, 'handlePointerMove');
      router.onPointerMove(makePointerEvent());
      router.onPointerLeave(makePointerEvent());
      flushRaf();  // flush cancelled rAF

      // New move after leave — should schedule a fresh rAF
      router.onPointerMove(makePointerEvent({ clientX: 100 }));
      flushRaf();
      expect(moveSpy).toHaveBeenCalledTimes(1);  // only the post-leave move
    });
  });

  // ── onKeyDown / onKeyUp ───────────────────────────────────────────────────

  describe('onKeyDown', () => {
    it('calls engine.handleKeyDown() synchronously', () => {
      const spy = vi.spyOn(engine, 'handleKeyDown');
      router.onKeyDown(makeKeyEvent('z', { ctrlKey: true }));
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('passes correct TimelineKeyEvent', () => {
      const spy = vi.spyOn(engine, 'handleKeyDown');
      router.onKeyDown(makeKeyEvent('Escape'));
      const evt = spy.mock.calls[0]![0] as TimelineKeyEvent;
      expect(evt.key).toBe('Escape');
    });
  });

  describe('onKeyUp', () => {
    it('calls engine.handleKeyUp() synchronously', () => {
      const spy = vi.spyOn(engine, 'handleKeyUp');
      router.onKeyUp(makeKeyEvent('Shift'));
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  // ── getLayout() called fresh on every event ───────────────────────────────

  describe('getLayout() freshness', () => {
    it('uses updated ppf for coordinate conversion without recreating the router', () => {
      let ppf = 10;
      const router2 = createToolRouter(engine, () => ({
        timelineOriginX: 0,
        pixelsPerFrame:  ppf,
        trackLayouts:    DEFAULT_TRACK_LAYOUTS,
      }));

      const spy = vi.spyOn(engine, 'handlePointerDown');

      // At ppf=10, clientX=100 → frame 10
      router2.onPointerDown(makePointerEvent({ clientX: 100 }));
      expect((spy.mock.calls[0]![0] as TimelinePointerEvent).frame).toBe(toFrame(10));

      // Zoom in: ppf=20. No need to recreate the router.
      ppf = 20;
      router2.onPointerDown(makePointerEvent({ clientX: 100 }));
      expect((spy.mock.calls[1]![0] as TimelinePointerEvent).frame).toBe(toFrame(5));
    });
  });
});
