/**
 * Phase R Step 4 — Integration tests
 *
 * Full round-trip: dispatch → engine → snapshot → hook → re-render.
 * Uses renderHook + act throughout. Playback tests use createTestClock().
 */

import type React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
  toClipId,
  toAssetId,
  createTestClock,
} from '@webpacked-timeline/core';
import type { PipelineConfig } from '@webpacked-timeline/core';
import type { VirtualWindow } from '@webpacked-timeline/core';
import { TimelineEngine } from '../engine';
import {
  useTrackIds,
  useTrack,
  useClip,
  useClips,
  useMarkers,
  useHistory,
  useActiveToolId,
  useCursor,
  useProvisional,
  usePlayheadFrame,
  useIsPlaying,
} from '../hooks/index';
import { useVirtualWindow, useVisibleClips } from '../hooks/use-virtual-window';
import { createToolRouter } from '../adapter/tool-router';

const FPS = 30;
const DURATION_FRAMES = 1800;
const TRACK_H = 48;
const PPF = 10;

function buildIntegrationEngine(): {
  engine: TimelineEngine;
  clock: ReturnType<typeof createTestClock>['clock'];
  tick: ReturnType<typeof createTestClock>['tick'];
} {
  const { clock, tick } = createTestClock();
  const videoAsset = createAsset({
    id: 'asset-v',
    name: 'V',
    mediaType: 'video',
    filePath: '/v.mp4',
    intrinsicDuration: toFrame(3000),
    nativeFps: FPS,
    sourceTimecodeOffset: toFrame(0),
  });
  const audioAsset = createAsset({
    id: 'asset-a',
    name: 'A',
    mediaType: 'audio',
    filePath: '/a.wav',
    intrinsicDuration: toFrame(2000),
    nativeFps: FPS,
    sourceTimecodeOffset: toFrame(0),
  });

  const v1Clip1 = createClip({
    id: 'v1-c1',
    assetId: videoAsset.id,
    trackId: 'v1',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(300),
    mediaIn: toFrame(0),
    mediaOut: toFrame(300),
  });
  const v1Clip2 = createClip({
    id: 'v1-c2',
    assetId: videoAsset.id,
    trackId: 'v1',
    timelineStart: toFrame(400),
    timelineEnd: toFrame(700),
    mediaIn: toFrame(0),
    mediaOut: toFrame(300),
  });
  const v1Clip3 = createClip({
    id: 'v1-c3',
    assetId: videoAsset.id,
    trackId: 'v1',
    timelineStart: toFrame(800),
    timelineEnd: toFrame(1100),
    mediaIn: toFrame(0),
    mediaOut: toFrame(300),
  });
  const v2Clip1 = createClip({
    id: 'v2-c1',
    assetId: videoAsset.id,
    trackId: 'v2',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(600),
    mediaIn: toFrame(0),
    mediaOut: toFrame(600),
  });
  const v2Clip2 = createClip({
    id: 'v2-c2',
    assetId: videoAsset.id,
    trackId: 'v2',
    timelineStart: toFrame(700),
    timelineEnd: toFrame(1100),
    mediaIn: toFrame(0),
    mediaOut: toFrame(400),
  });
  const a1Clip1 = createClip({
    id: 'a1-c1',
    assetId: audioAsset.id,
    trackId: 'a1',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(600),
    mediaIn: toFrame(0),
    mediaOut: toFrame(600),
  });

  const trackV1 = createTrack({
    id: 'v1',
    name: 'V1',
    type: 'video',
    clips: [v1Clip1, v1Clip2, v1Clip3],
  });
  const trackV2 = createTrack({
    id: 'v2',
    name: 'V2',
    type: 'video',
    clips: [v2Clip1, v2Clip2],
  });
  const trackA1 = createTrack({
    id: 'a1',
    name: 'A1',
    type: 'audio',
    clips: [a1Clip1],
  });

  const markerPoint = {
    type: 'point' as const,
    id: 'm1',
    frame: toFrame(150),
    label: 'M1',
    color: '#f00',
    scope: 'global' as const,
    linkedClipId: null,
  };
  const markerRange = {
    type: 'range' as const,
    id: 'm2',
    frameStart: toFrame(400),
    frameEnd: toFrame(700),
    label: 'M2',
    color: '#0f0',
    scope: 'global' as const,
    linkedClipId: null,
  };

  const timeline = createTimeline({
    id: 'tl-int',
    name: 'Integration',
    fps: FPS,
    duration: toFrame(DURATION_FRAMES),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [trackV1, trackV2, trackA1],
    markers: [markerPoint, markerRange],
  });

  const initialState = createTimelineState({
    timeline,
    assetRegistry: new Map([
      [videoAsset.id, videoAsset],
      [audioAsset.id, audioAsset],
    ]),
  });

  const mockPipeline: PipelineConfig = {
    videoDecoder: async (req) => ({
      clipId: req.clipId,
      mediaFrame: req.mediaFrame,
      width: 1920,
      height: 1080,
      bitmap: null,
    }),
    compositor: async (req) => ({ timelineFrame: req.timelineFrame, bitmap: null }),
  };

  const engine = new TimelineEngine({
    initialState,
    pipeline: mockPipeline,
    dimensions: { width: 1920, height: 1080 },
    clock,
  });

  return { engine, clock, tick };
}

function makePointerEvent(overrides: {
  clientX?: number;
  clientY?: number;
  buttons?: number;
} = {}): React.PointerEvent {
  return {
    clientX: overrides.clientX ?? 0,
    clientY: overrides.clientY ?? 0,
    buttons: overrides.buttons ?? 1,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ctrlKey: false,
    preventDefault: vi.fn(),
    currentTarget: {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 10000, height: 400 }),
    },
  } as unknown as React.PointerEvent;
}

function makeKeyEvent(overrides: { key?: string; code?: string; shiftKey?: boolean } = {}): React.KeyboardEvent {
  return {
    key: overrides.key ?? ' ',
    code: overrides.code ?? 'Space',
    shiftKey: overrides.shiftKey ?? false,
    altKey: false,
    metaKey: false,
    ctrlKey: false,
    repeat: false,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent;
}

// ─── Edit + hooks round-trip ─────────────────────────────────────────────

describe('Integration — Edit + hooks round-trip', () => {
  let engine: TimelineEngine;

  beforeEach(() => {
    const built = buildIntegrationEngine();
    engine = built.engine;
  });

  it('1. dispatch INSERT_CLIP → useClips returns new clip', () => {
    const trackId = toTrackId('v1');
    const { result } = renderHook(() => useClips(engine, trackId));
    const countBefore = result.current.length;
    const newClip = createClip({
      id: 'v1-new',
      assetId: toAssetId('asset-v'),
      trackId: 'v1',
      timelineStart: toFrame(300),
      timelineEnd: toFrame(400),
      mediaIn: toFrame(0),
      mediaOut: toFrame(100),
    });
    act(() => {
      engine.dispatch({
        id: 'add',
        label: 'Add clip',
        timestamp: 0,
        operations: [{ type: 'INSERT_CLIP', trackId, clip: newClip }],
      });
    });
    expect(result.current.length).toBe(countBefore + 1);
    expect(result.current.some((c) => c.id === 'v1-new')).toBe(true);
  });

  it('2. dispatch MOVE_CLIP → useClip returns updated startFrame', () => {
    const clipId = 'v1-c1';
    const { result } = renderHook(() => useClip(engine, clipId));
    expect((result.current!.timelineStart as number)).toBe(0);
    act(() => {
      engine.dispatch({
        id: 'move',
        label: 'Move',
        timestamp: 0,
        operations: [
          { type: 'MOVE_CLIP', clipId: toClipId(clipId), newTimelineStart: toFrame(100) },
        ],
      });
    });
    expect((result.current!.timelineStart as number)).toBe(100);
  });

  it('3. dispatch DELETE_CLIP → useClips no longer contains deleted clip', () => {
    const trackId = toTrackId('v1');
    const { result } = renderHook(() => useClips(engine, trackId));
    const idToDelete = 'v1-c2';
    act(() => {
      engine.dispatch({
        id: 'del',
        label: 'Delete',
        timestamp: 0,
        operations: [{ type: 'DELETE_CLIP', clipId: toClipId(idToDelete) }],
      });
    });
    expect(result.current.some((c) => c.id === idToDelete)).toBe(false);
  });

  it('4. useTrackIds stable after MOVE_CLIP (no track list change → same array ref)', () => {
    const { result, rerender } = renderHook(() => useTrackIds(engine));
    const refBefore = result.current;
    act(() => {
      engine.dispatch({
        id: 'move',
        label: 'Move',
        timestamp: 0,
        operations: [
          { type: 'MOVE_CLIP', clipId: toClipId('v1-c1'), newTimelineStart: toFrame(50) },
        ],
      });
    });
    rerender();
    expect(result.current).toBe(refBefore);
  });

  it('5. useTrackIds updates after ADD_TRACK', () => {
    const { result } = renderHook(() => useTrackIds(engine));
    const countBefore = result.current.length;
    const newTrack = createTrack({
      id: 'v3',
      name: 'V3',
      type: 'video',
      clips: [],
    });
    act(() => {
      engine.dispatch({
        id: 'add-track',
        label: 'Add track',
        timestamp: 0,
        operations: [{ type: 'ADD_TRACK', track: newTrack }],
      });
    });
    expect(result.current.length).toBe(countBefore + 1);
    expect(result.current).toContain('v3');
  });

  it('6. useHistory.canUndo true after dispatch', () => {
    const { result } = renderHook(() => useHistory(engine));
    expect(result.current.canUndo).toBe(false);
    act(() => {
      engine.dispatch({
        id: 'move',
        label: 'Move',
        timestamp: 0,
        operations: [
          { type: 'MOVE_CLIP', clipId: toClipId('v1-c1'), newTimelineStart: toFrame(10) },
        ],
      });
    });
    expect(result.current.canUndo).toBe(true);
  });

  it('7. undo() → useClip returns original position', () => {
    const clipId = 'v1-c1';
    const { result } = renderHook(() => useClip(engine, clipId));
    const originalStart = result.current!.timelineStart as number;
    act(() => {
      const r = engine.dispatch({
        id: 'move',
        label: 'Move',
        timestamp: 0,
        operations: [
          { type: 'MOVE_CLIP', clipId: toClipId(clipId), newTimelineStart: toFrame(1100) },
        ],
      });
      expect(r.accepted).toBe(true);
    });
    act(() => {
      engine.undo();
    });
    expect((result.current!.timelineStart as number)).toBe(originalStart);
  });

  it('8. redo() → useClip returns moved position', () => {
    const clipId = 'v1-c1';
    const newStart = 1100;
    const { result } = renderHook(() => useClip(engine, clipId));
    act(() => {
      engine.dispatch({
        id: 'move',
        label: 'Move',
        timestamp: 0,
        operations: [
          { type: 'MOVE_CLIP', clipId: toClipId(clipId), newTimelineStart: toFrame(newStart) },
        ],
      });
    });
    act(() => {
      engine.undo();
    });
    expect((result.current!.timelineStart as number)).toBe(0);
    let didRedo: boolean;
    act(() => {
      didRedo = engine.redo();
    });
    expect(didRedo).toBe(true);
    const clip = engine.getSnapshot().state.timeline.tracks[0]!.clips.find((c) => c.id === clipId);
    expect(clip!.timelineStart).toBe(newStart);
    expect((result.current!.timelineStart as number)).toBe(newStart);
  });

  it('9. dispatch ADD_MARKER → useMarkers updates', () => {
    const { result } = renderHook(() => useMarkers(engine));
    const countBefore = result.current.length;
    const newMarker = {
      type: 'point' as const,
      id: 'm3',
      frame: toFrame(500),
      label: 'M3',
      color: '#00f',
      scope: 'global' as const,
      linkedClipId: null,
    };
    act(() => {
      engine.dispatch({
        id: 'add-marker',
        label: 'Add marker',
        timestamp: 0,
        operations: [{ type: 'ADD_MARKER', marker: newMarker }],
      });
    });
    expect(result.current.length).toBe(countBefore + 1);
    expect(result.current.some((m) => m.id === 'm3')).toBe(true);
  });

  it('10. useClip isolation: dispatch MOVE_CLIP on clip A → render count for clip B unchanged', () => {
    const clipAId = 'v1-c1';
    const clipBId = 'v2-c1';
    let clipBRenderCount = 0;
    const { result } = renderHook(() => {
      const clipB = useClip(engine, clipBId);
      clipBRenderCount++;
      return clipB;
    });
    expect(clipBRenderCount).toBe(1);
    act(() => {
      engine.dispatch({
        id: 'move',
        label: 'Move A',
        timestamp: 0,
        operations: [
          { type: 'MOVE_CLIP', clipId: toClipId(clipAId), newTimelineStart: toFrame(20) },
        ],
      });
    });
    expect(result.current).not.toBeNull();
    expect(result.current!.id).toBe(clipBId);
    expect(clipBRenderCount).toBe(1);
  });
});

// ─── Tool interaction round-trip ────────────────────────────────────────

describe('Integration — Tool interaction round-trip', () => {
  let engine: TimelineEngine;

  beforeEach(() => {
    const built = buildIntegrationEngine();
    engine = built.engine;
  });

  it('11. Activate RazorTool → useActiveToolId === "razor"', () => {
    const { result } = renderHook(() => useActiveToolId(engine));
    expect(result.current).toBe('selection');
    act(() => {
      engine.activateTool('razor');
    });
    expect(result.current).toBe('razor');
  });

  it('12. Activate SelectionTool → cursor is "default"', () => {
    act(() => {
      engine.activateTool('razor');
    });
    const { result } = renderHook(() => useCursor(engine));
    act(() => {
      engine.activateTool('selection');
    });
    expect(result.current).toBe('default');
  });

  it('13. handlePointerDown + handlePointerUp with RazorTool dispatches SPLIT → useClips has one more clip', () => {
    const trackId = toTrackId('v1');
    const { result } = renderHook(() => useClips(engine, trackId));
    const countBefore = result.current.length;
    act(() => {
      engine.activateTool('razor');
    });
    const frameInClip = 450;
    const modifiers = { shift: false, alt: false, ctrl: false, meta: false };
    const syntheticEvent = {
      frame: toFrame(frameInClip),
      trackId: toTrackId('v1'),
      clipId: toClipId('v1-c2'),
      x: frameInClip * PPF,
      y: TRACK_H * 0.5,
      buttons: 1,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    };
    act(() => {
      engine.handlePointerDown(syntheticEvent, modifiers);
    });
    act(() => {
      engine.handlePointerUp(
        { ...syntheticEvent, buttons: 0 },
        modifiers,
      );
    });
    expect(result.current.length).toBe(countBefore + 1);
  });

  it('14. handlePointerLeave clears provisional state → useProvisional returns null', () => {
    act(() => {
      engine.activateTool('selection');
    });
    const handlers = createToolRouter({
      engine,
      getPixelsPerFrame: () => PPF,
    });
    const rect = { left: 0, top: 0, width: 10000, height: 400 };
    const down = makePointerEvent({ clientX: 100, clientY: TRACK_H / 2, buttons: 1 });
    (down as { currentTarget: { getBoundingClientRect: () => typeof rect } }).currentTarget = {
      getBoundingClientRect: () => rect,
    };
    act(() => {
      handlers.onPointerDown(down);
    });
    const { result } = renderHook(() => useProvisional(engine));
    const leave = makePointerEvent({ clientX: 0, clientY: 0, buttons: 0 });
    (leave as { currentTarget: { getBoundingClientRect: () => typeof rect } }).currentTarget = {
      getBoundingClientRect: () => rect,
    };
    act(() => {
      handlers.onPointerLeave(leave);
    });
    expect(result.current).toBeNull();
  });
});

// ─── Playback + edit simultaneous ─────────────────────────────────────────

describe('Integration — Playback + edit simultaneous', () => {
  it('15. play() → useIsPlaying true', () => {
    const { engine } = buildIntegrationEngine();
    const { result } = renderHook(() => useIsPlaying(engine));
    expect(result.current).toBe(false);
    act(() => {
      engine.playbackEngine!.play();
    });
    expect(result.current).toBe(true);
  });

  it('16. pause() → useIsPlaying false', () => {
    const { engine } = buildIntegrationEngine();
    act(() => {
      engine.playbackEngine!.play();
    });
    const { result } = renderHook(() => useIsPlaying(engine));
    expect(result.current).toBe(true);
    act(() => {
      engine.playbackEngine!.pause();
    });
    expect(result.current).toBe(false);
  });

  it('17. dispatch during playback does not crash', () => {
    const { engine, tick } = buildIntegrationEngine();
    act(() => {
      engine.playbackEngine!.play();
    });
    act(() => {
      tick(100);
    });
    act(() => {
      engine.dispatch({
        id: 'move',
        label: 'Move',
        timestamp: 0,
        operations: [
          { type: 'MOVE_CLIP', clipId: toClipId('v1-c1'), newTimelineStart: toFrame(50) },
        ],
      });
    });
    expect(engine.getSnapshot().state.timeline.tracks[0]!.clips[0]!.timelineStart).toBe(50);
  });

  it('18. seekTo(300) → usePlayheadFrame === 300', () => {
    const { engine } = buildIntegrationEngine();
    const { result } = renderHook(() => usePlayheadFrame(engine));
    act(() => {
      engine.playbackEngine!.seekTo(toFrame(300));
    });
    expect(result.current).toBe(300);
  });

  it('19. tick(1000ms at 30fps) → usePlayheadFrame advanced', () => {
    const { engine, tick } = buildIntegrationEngine();
    act(() => {
      engine.playbackEngine!.seekTo(toFrame(0));
      engine.playbackEngine!.play();
    });
    act(() => {
      tick(0);
      for (let i = 0; i < 20; i++) tick(50);
    });
    const playheadState = engine.playbackEngine!.getState();
    const frameAfter = playheadState.currentFrame as number;
    expect(frameAfter).toBeGreaterThan(0);
    expect(frameAfter).toBeLessThanOrEqual(1800);
  });

  it('20. loop region: setLoopRegion → play → tick past end → usePlayheadFrame wraps', () => {
    const { engine, tick } = buildIntegrationEngine();
    act(() => {
      engine.playbackEngine!.setLoopRegion({
        startFrame: toFrame(100),
        endFrame: toFrame(150),
      });
    });
    act(() => {
      engine.playbackEngine!.seekTo(toFrame(100));
    });
    act(() => {
      engine.playbackEngine!.play();
    });
    act(() => {
      tick(2000);
    });
    const frame = engine.getSnapshot().playhead.currentFrame as number;
    expect(frame).toBeGreaterThanOrEqual(100);
    expect(frame).toBeLessThan(150);
  });
});

// ─── Virtual rendering ────────────────────────────────────────────────────

describe('Integration — Virtual rendering', () => {
  let engine: TimelineEngine;

  beforeEach(() => {
    const built = buildIntegrationEngine();
    engine = built.engine;
  });

  it('21. useVisibleClips with window 0–300 returns clips in that range', () => {
    const window: VirtualWindow = {
      startFrame: toFrame(0),
      endFrame: toFrame(300),
      pixelsPerFrame: PPF,
    };
    const { result } = renderHook(() => useVisibleClips(engine, window));
    const visible = result.current.filter((e) => e.isVisible);
    expect(visible.length).toBeGreaterThanOrEqual(2);
    visible.forEach((e) => {
      expect((e.clip.timelineEnd as number) > 0).toBe(true);
      expect((e.clip.timelineStart as number) < 300).toBe(true);
    });
  });

  it('22. useVisibleClips updates when new clip dispatched inside window', () => {
    const window: VirtualWindow = {
      startFrame: toFrame(0),
      endFrame: toFrame(500),
      pixelsPerFrame: PPF,
    };
    const { result } = renderHook(() => useVisibleClips(engine, window));
    const countBefore = result.current.filter((e) => e.isVisible).length;
    const newClip = createClip({
      id: 'v1-gap',
      assetId: toAssetId('asset-v'),
      trackId: 'v1',
      timelineStart: toFrame(300),
      timelineEnd: toFrame(400),
      mediaIn: toFrame(0),
      mediaOut: toFrame(100),
    });
    act(() => {
      engine.dispatch({
        id: 'add',
        label: 'Add',
        timestamp: 0,
        operations: [
          { type: 'INSERT_CLIP', trackId: toTrackId('v1'), clip: newClip },
        ],
      });
    });
    expect(result.current.filter((e) => e.isVisible).length).toBe(countBefore + 1);
  });

  it('23. Clip outside window has isVisible: false', () => {
    const window: VirtualWindow = {
      startFrame: toFrame(1500),
      endFrame: toFrame(1800),
      pixelsPerFrame: PPF,
    };
    const { result } = renderHook(() => useVisibleClips(engine, window));
    const entries = result.current;
    const v1Clips = entries.filter((e) => e.track.id === 'v1');
    v1Clips.forEach((e) => {
      const end = e.clip.timelineEnd as number;
      const start = e.clip.timelineStart as number;
      expect(end <= 1500 || start >= 1800 ? !e.isVisible : true).toBe(true);
    });
  });
});

// ─── Compression ─────────────────────────────────────────────────────────

describe('Integration — Compression', () => {
  it('24. Rapid MOVE_CLIP dispatches (5 in sequence) → undo() restores position from BEFORE all 5', () => {
    const { engine } = buildIntegrationEngine();
    const clipId = toClipId('v1-c1');
    const { result } = renderHook(() => useClip(engine, clipId));
    const originalStart = result.current!.timelineStart as number;
    act(() => {
      for (let i = 1; i <= 5; i++) {
        engine.dispatch({
          id: `move-${i}`,
          label: `Move ${i}`,
          timestamp: i,
          operations: [
            { type: 'MOVE_CLIP', clipId, newTimelineStart: toFrame(originalStart + i * 10) },
          ],
        });
      }
    });
    expect((result.current!.timelineStart as number)).toBe(originalStart + 50);
    act(() => {
      engine.undo();
    });
    expect((result.current!.timelineStart as number)).toBe(originalStart);
  });
});

// ─── Keyboard ─────────────────────────────────────────────────────────────

describe('Integration — Keyboard', () => {
  it('25. handleKeyDown Space → useIsPlaying true (requires pipeline)', () => {
    const { engine } = buildIntegrationEngine();
    const { result } = renderHook(() => useIsPlaying(engine));
    const handlers = createToolRouter({
      engine,
      getPixelsPerFrame: () => PPF,
    });
    act(() => {
      handlers.onKeyDown(makeKeyEvent({ key: ' ', code: 'Space' }));
    });
    expect(result.current).toBe(true);
  });

  it('26. handleKeyDown ArrowRight → usePlayheadFrame advanced by 1', () => {
    const { engine } = buildIntegrationEngine();
    act(() => {
      engine.playbackEngine!.seekTo(toFrame(100));
    });
    const { result } = renderHook(() => usePlayheadFrame(engine));
    const handlers = createToolRouter({
      engine,
      getPixelsPerFrame: () => PPF,
    });
    act(() => {
      handlers.onKeyDown(makeKeyEvent({ key: 'ArrowRight', code: 'ArrowRight' }));
    });
    expect(result.current).toBe(101);
  });

  it('27. handleKeyDown Shift+ArrowRight → seekToNextClipBoundary → usePlayheadFrame at next boundary', () => {
    const { engine } = buildIntegrationEngine();
    act(() => {
      engine.playbackEngine!.seekTo(toFrame(0));
    });
    const { result } = renderHook(() => usePlayheadFrame(engine));
    const handlers = createToolRouter({
      engine,
      getPixelsPerFrame: () => PPF,
    });
    act(() => {
      handlers.onKeyDown(
        makeKeyEvent({ key: 'ArrowRight', code: 'ArrowRight', shiftKey: true }),
      );
    });
    expect(result.current).toBe(300);
  });
});
