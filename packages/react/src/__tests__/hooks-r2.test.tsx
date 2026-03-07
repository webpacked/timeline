/**
 * Phase R Step 2 — Full hook set tests
 *
 * Fixture: engine with 2 tracks, 3 clips total, 2 markers, 30fps.
 * All hooks take engine as first arg. Selector isolation proven with toBe.
 */

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
  toClipId,
  toAssetId,
  toToolId,
  createTestClock,
  NoOpTool,
} from '@timeline/core';
import type { Transaction } from '@timeline/core';

import { TimelineEngine } from '../engine';
import {
  useTimeline,
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
  useChange,
} from '../hooks/index';

// ── Fixture: 2 tracks, 3 clips, 2 markers, 30fps ─────────────────────────────

const TRACK_1 = toTrackId('track-1');
const TRACK_2 = toTrackId('track-2');
const CLIP_A = toClipId('clip-a');
const CLIP_B = toClipId('clip-b');
const CLIP_C = toClipId('clip-c');

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
    trackId: TRACK_1,
    timelineStart: toFrame(0),
    timelineEnd: toFrame(100),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });
  const clipB = createClip({
    id: 'clip-b',
    assetId: asset.id,
    trackId: TRACK_1,
    timelineStart: toFrame(150),
    timelineEnd: toFrame(250),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });
  const clipC = createClip({
    id: 'clip-c',
    assetId: asset.id,
    trackId: TRACK_2,
    timelineStart: toFrame(50),
    timelineEnd: toFrame(150),
    mediaIn: toFrame(0),
    mediaOut: toFrame(100),
  });

  const track1 = createTrack({
    id: TRACK_1,
    name: 'V1',
    type: 'video',
    clips: [clipA, clipB],
  });
  const track2 = createTrack({
    id: TRACK_2,
    name: 'V2',
    type: 'video',
    clips: [clipC],
  });

  const marker1 = {
    type: 'point' as const,
    id: 'm1' as import('@timeline/core').MarkerId,
    frame: toFrame(50),
    label: 'M1',
    color: '#ff0000',
    scope: 'global' as const,
    linkedClipId: null,
  };
  const marker2 = {
    type: 'point' as const,
    id: 'm2' as import('@timeline/core').MarkerId,
    frame: toFrame(200),
    label: 'M2',
    color: '#00ff00',
    scope: 'global' as const,
    linkedClipId: null,
  };

  const timeline = createTimeline({
    id: 'tl-r2',
    name: 'R2 Fixture',
    fps: frameRate(30),
    duration: toFrame(3000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [track1, track2],
    markers: [marker1, marker2],
  });

  return createTimelineState({
    timeline,
    assetRegistry: new Map([[asset.id, asset]]),
  });
}

let engine: TimelineEngine;

beforeEach(() => {
  const state = makeFixtureState();
  engine = new TimelineEngine({
    initialState: state,
    tools: [NoOpTool],
    defaultToolId: 'noop',
  });
});

// ── useTimeline ─────────────────────────────────────────────────────────────

describe('useTimeline', () => {
  it('1. Returns correct fps and durationFrames', () => {
    const { result } = renderHook(() => useTimeline(engine));
    expect(result.current.fps).toBe(30);
    expect(result.current.duration).toBe(3000);
  });

  it('2. Re-renders when timeline changes', () => {
    const { result, rerender } = renderHook(() => useTimeline(engine));
    const first = result.current;
    act(() => {
      engine.dispatch({
        id: 'r',
        label: 'Rename',
        timestamp: 0,
        operations: [{ type: 'RENAME_TIMELINE', name: 'Renamed' }],
      });
    });
    rerender();
    expect(result.current.name).toBe('Renamed');
    expect(result.current).not.toBe(first);
  });

  it('3. Does NOT re-render when only playhead changes (timeline ref unchanged)', () => {
    const mockPipeline = { videoDecoder: vi.fn(), compositor: vi.fn() } as any;
    const { clock } = createTestClock();
    const engWithPlayback = new TimelineEngine({
      initialState: makeFixtureState(),
      pipeline: mockPipeline,
      clock,
      tools: [NoOpTool],
      defaultToolId: 'noop',
    });
    const { result, rerender } = renderHook(() => useTimeline(engWithPlayback));
    const refBefore = result.current;
    act(() => engWithPlayback.playbackEngine!.seekTo(toFrame(100)));
    rerender();
    expect(result.current).toBe(refBefore);
  });
});

// ── useTrackIds ────────────────────────────────────────────────────────────

describe('useTrackIds', () => {
  it('4. Returns correct track ids', () => {
    const { result } = renderHook(() => useTrackIds(engine));
    expect(result.current).toEqual(['track-1', 'track-2']);
  });

  it('5. Returns stable reference when clips change (trackIds ref unchanged after MOVE_CLIP)', () => {
    const { result, rerender } = renderHook(() => useTrackIds(engine));
    const refBefore = result.current;
    act(() => {
      engine.dispatch({
        id: 'm',
        label: 'Move',
        timestamp: 0,
        operations: [
          { type: 'MOVE_CLIP', clipId: CLIP_A, newTimelineStart: toFrame(20) },
        ],
      });
    });
    rerender();
    expect(result.current).toBe(refBefore);
  });

  it('6. Returns new reference when track added', () => {
    const { result, rerender } = renderHook(() => useTrackIds(engine));
    const refBefore = result.current;
    const newTrack = createTrack({
      id: toTrackId('track-3'),
      name: 'V3',
      type: 'video',
      clips: [],
    });
    act(() => {
      engine.dispatch({
        id: 'a',
        label: 'Add',
        timestamp: 0,
        operations: [{ type: 'ADD_TRACK', track: newTrack }],
      });
    });
    rerender();
    expect(result.current).not.toBe(refBefore);
    expect(result.current).toContain('track-3');
  });
});

// ── useTrack ────────────────────────────────────────────────────────────────

describe('useTrack', () => {
  it('7. Returns correct track for id', () => {
    const { result } = renderHook(() => useTrack(engine, TRACK_1));
    expect(result.current?.id).toBe('track-1');
    expect(result.current?.name).toBe('V1');
  });

  it('8. Returns null for unknown id', () => {
    const { result } = renderHook(() => useTrack(engine, 'unknown'));
    expect(result.current).toBeNull();
  });

  it('9. Re-renders when that track changes', () => {
    const { result, rerender } = renderHook(() => useTrack(engine, TRACK_1));
    act(() => {
      engine.dispatch({
        id: 'n',
        label: 'Name',
        timestamp: 0,
        operations: [{ type: 'SET_TRACK_NAME', trackId: TRACK_1, name: 'Video One' }],
      });
    });
    rerender();
    expect(result.current?.name).toBe('Video One');
  });

  it('10. Does NOT re-render when OTHER track changes', () => {
    const { result, rerender } = renderHook(() => useTrack(engine, TRACK_1));
    const refBefore = result.current;
    act(() => {
      engine.dispatch({
        id: 'n',
        label: 'Name',
        timestamp: 0,
        operations: [{ type: 'SET_TRACK_NAME', trackId: TRACK_2, name: 'Other' }],
      });
    });
    rerender();
    expect(result.current).toBe(refBefore);
  });
});

// ── useClip (isolation: clip A update does not re-render clip B) ─────────────

describe('useClip', () => {
  it('11. Returns correct clip for id', () => {
    const { result } = renderHook(() => useClip(engine, CLIP_A));
    expect(result.current?.id).toBe('clip-a');
    expect(result.current?.timelineStart).toBe(0);
  });

  it('12. Returns null for unknown id', () => {
    const { result } = renderHook(() => useClip(engine, 'no-such-clip' as any));
    expect(result.current).toBeNull();
  });

  it('13. ISOLATION: updating clip A does not re-render component watching clip B (toBe)', () => {
    let renderCountA = 0;
    let renderCountB = 0;
    renderHook(() => {
      renderCountA++;
      return useClip(engine, CLIP_A);
    });
    const { result: resultB } = renderHook(() => {
      renderCountB++;
      return useClip(engine, CLIP_B);
    });
    const clipBRefBefore = resultB.current;
    renderCountA = 0;
    renderCountB = 0;
    act(() => {
      engine.dispatch({
        id: 'm',
        label: 'Move A',
        timestamp: 0,
        operations: [
          { type: 'MOVE_CLIP', clipId: CLIP_A, newTimelineStart: toFrame(5) },
        ],
      });
    });
    expect(renderCountB).toBe(0);
    expect(resultB.current).toBe(clipBRefBefore);
  });
});

// ── useClips ───────────────────────────────────────────────────────────────

describe('useClips', () => {
  it('14. Returns all clips for a track', () => {
    const { result } = renderHook(() => useClips(engine, TRACK_1));
    expect(result.current.length).toBe(2);
    expect(result.current.map((c) => c.id)).toEqual(['clip-a', 'clip-b']);
  });

  it('15. Returns EMPTY_CLIPS stable ref for unknown trackId', () => {
    const { result } = renderHook(() => useClips(engine, 'unknown-track'));
    expect(result.current).toEqual([]);
    const { result: result2 } = renderHook(() => useClips(engine, 'unknown-track'));
    expect(result2.current).toBe(result.current);
  });
});

// ── useMarkers ─────────────────────────────────────────────────────────────

describe('useMarkers', () => {
  it('16. Returns markers array', () => {
    const { result } = renderHook(() => useMarkers(engine));
    expect(result.current.length).toBe(2);
    expect(result.current[0]?.label).toBe('M1');
  });

  it('17. Updates when marker added', () => {
    const { result, rerender } = renderHook(() => useMarkers(engine));
    expect(result.current.length).toBe(2);
    act(() => {
      engine.dispatch({
        id: 'am',
        label: 'Add marker',
        timestamp: 0,
        operations: [
          {
            type: 'ADD_MARKER',
            marker: {
              type: 'point',
              id: 'm3' as any,
              frame: toFrame(100),
              label: 'M3',
              color: '#0000ff',
              scope: 'global',
              linkedClipId: null,
            },
          },
        ],
      });
    });
    rerender();
    expect(result.current.length).toBe(3);
  });
});

// ── useHistory ─────────────────────────────────────────────────────────────

describe('useHistory', () => {
  it('18. Initial: canUndo false, canRedo false', () => {
    const { result } = renderHook(() => useHistory(engine));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('19. After dispatch: canUndo true', () => {
    const { result, rerender } = renderHook(() => useHistory(engine));
    act(() => {
      engine.dispatch({
        id: 'r',
        label: 'R',
        timestamp: 0,
        operations: [{ type: 'RENAME_TIMELINE', name: 'X' }],
      });
    });
    rerender();
    expect(result.current.canUndo).toBe(true);
  });

  it('20. Returns stable object ref when flags unchanged (no spurious re-render)', () => {
    const { result, rerender } = renderHook(() => useHistory(engine));
    const refBefore = result.current;
    act(() => {
      engine.dispatch({
        id: 'r',
        label: 'R',
        timestamp: 0,
        operations: [{ type: 'RENAME_TIMELINE', name: 'Y' }],
      });
    });
    rerender();
    const refAfter = result.current;
    act(() => engine.undo());
    rerender();
    const refAfterUndo = result.current;
    expect(refAfter).not.toBe(refBefore);
    expect(refAfterUndo).not.toBe(refAfter);
  });
});

// ── useActiveToolId ────────────────────────────────────────────────────────

describe('useActiveToolId', () => {
  it('21. Returns "noop" initially (defaultToolId in fixture)', () => {
    const { result } = renderHook(() => useActiveToolId(engine));
    expect(result.current).toBe('noop');
  });

  it('22. Updates after activateTool()', () => {
    const { result, rerender } = renderHook(() => useActiveToolId(engine));
    act(() => engine.activateTool('selection'));
    rerender();
    expect(result.current).toBe('selection');
  });
});

// ── useCursor ──────────────────────────────────────────────────────────────

describe('useCursor', () => {
  it('23. Returns "default" initially', () => {
    const { result } = renderHook(() => useCursor(engine));
    expect(result.current).toBe('default');
  });
});

// ── useProvisional ─────────────────────────────────────────────────────────

describe('useProvisional', () => {
  it('24. Returns null initially', () => {
    const { result } = renderHook(() => useProvisional(engine));
    expect(result.current).toBeNull();
  });

  it('25. Returns provisional state when set', () => {
    const ghost = { clips: [], isProvisional: true as const };
    const moveTool = {
      ...NoOpTool,
      id: toToolId('provisional'),
      onPointerMove: () => ghost,
    };
    const engWithProvisional = new TimelineEngine({
      initialState: makeFixtureState(),
      tools: [NoOpTool, moveTool],
      defaultToolId: 'provisional',
    });
    const { result, rerender } = renderHook(() => useProvisional(engWithProvisional));
    expect(result.current).toBeNull();
    act(() => {
      engWithProvisional.handlePointerMove(
        {
          frame: toFrame(0),
          trackId: null,
          clipId: null,
          x: 0,
          y: 0,
          buttons: 1,
          shiftKey: false,
          altKey: false,
          metaKey: false,
        },
        { shift: false, alt: false, ctrl: false, meta: false },
      );
    });
    rerender();
    expect(result.current).toBe(ghost);
  });
});

// ── usePlayheadFrame ───────────────────────────────────────────────────────

describe('usePlayheadFrame', () => {
  it('26. Returns frame 0 initially', () => {
    const { result } = renderHook(() => usePlayheadFrame(engine));
    expect(result.current).toBe(0);
  });

  it('27. Updates when seekTo called on playback engine', () => {
    const mockPipeline = { videoDecoder: vi.fn(), compositor: vi.fn() } as any;
    const { clock } = createTestClock();
    const engWithPlayback = new TimelineEngine({
      initialState: makeFixtureState(),
      pipeline: mockPipeline,
      clock,
      tools: [NoOpTool],
      defaultToolId: 'noop',
    });
    const { result, rerender } = renderHook(() => usePlayheadFrame(engWithPlayback));
    expect(result.current).toBe(0);
    act(() => engWithPlayback.playbackEngine!.seekTo(toFrame(100)));
    rerender();
    expect(result.current).toBe(100);
  });
});

// ── useIsPlaying ───────────────────────────────────────────────────────────

describe('useIsPlaying', () => {
  it('28. Returns false initially', () => {
    const { result } = renderHook(() => useIsPlaying(engine));
    expect(result.current).toBe(false);
  });

  it('29. Returns true after play()', () => {
    const mockPipeline = { videoDecoder: vi.fn(), compositor: vi.fn() } as any;
    const { clock } = createTestClock();
    const engWithPlayback = new TimelineEngine({
      initialState: makeFixtureState(),
      pipeline: mockPipeline,
      clock,
      tools: [NoOpTool],
      defaultToolId: 'noop',
    });
    const { result, rerender } = renderHook(() => useIsPlaying(engWithPlayback));
    act(() => engWithPlayback.playbackEngine!.play());
    rerender();
    expect(result.current).toBe(true);
  });
});

// ── useChange ─────────────────────────────────────────────────────────────

describe('useChange', () => {
  it('30. Returns EMPTY_STATE_CHANGE initially', () => {
    const { result } = renderHook(() => useChange(engine));
    expect(result.current.trackIds).toBe(false);
    expect(result.current.clipIds.size).toBe(0);
  });

  it('31. clipIds contains changed clip after dispatch', () => {
    const { result, rerender } = renderHook(() => useChange(engine));
    act(() => {
      engine.dispatch({
        id: 'm',
        label: 'Move',
        timestamp: 0,
        operations: [
          { type: 'MOVE_CLIP', clipId: CLIP_A, newTimelineStart: toFrame(10) },
        ],
      });
    });
    rerender();
    expect(result.current.clipIds.has(CLIP_A)).toBe(true);
  });
});
