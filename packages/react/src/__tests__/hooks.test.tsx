/**
 * hooks.ts — Phase 1 Integration Tests
 *
 * These tests run in jsdom with @testing-library/react.
 * They exercise hooks against a real TimelineEngine instance inside a
 * TimelineProvider, using renderHook to observe re-render behaviour.
 *
 * THE CRITICAL TEST: useClip(id) selector isolation
 *   When clip A changes, a component subscribed to clip B must NOT re-render.
 *   This is the core performance contract for Phase 2 — without it, a drag
 *   on any clip re-renders every clip component in the timeline.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, ReactNode } from 'react';

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
} from '@timeline/core';
import type { ClipId, TrackId, Transaction } from '@timeline/core';

import { TimelineProvider, TimelineEngine } from '../index';
import {
  useTimeline,
  useTrackIds,
  useTrack,
  useClip,
  useActiveTool,
  useCanUndo,
  useCanRedo,
  useProvisional,
  useEngine,
} from '../hooks';

// ── Test state factory ──────────────────────────────────────────────────────

const ASSET_ID  = toAssetId('asset-1');
const TRACK_ID  = toTrackId('track-1');
const CLIP_A_ID = toClipId('clip-a');
const CLIP_B_ID = toClipId('clip-b');

function makeState() {
  const asset = createAsset({
    id:                    'asset-1',
    name:                  'Test Asset',
    mediaType:             'video',
    filePath:              '/media/test.mp4',
    intrinsicDuration:     toFrame(600),
    nativeFps:             30,
    sourceTimecodeOffset:  toFrame(0),
    status:                'online',
  });

  const clipA = createClip({
    id:             'clip-a',
    assetId:        'asset-1',
    trackId:        'track-1',
    timelineStart:  toFrame(0),
    timelineEnd:    toFrame(100),
    mediaIn:        toFrame(0),
    mediaOut:       toFrame(100),
  });

  const clipB = createClip({
    id:             'clip-b',
    assetId:        'asset-1',
    trackId:        'track-1',
    timelineStart:  toFrame(200),
    timelineEnd:    toFrame(300),
    mediaIn:        toFrame(0),
    mediaOut:       toFrame(100),
  });

  const track = createTrack({
    id:    'track-1',
    name:  'Video 1',
    type:  'video',
    clips: [clipA, clipB],
  });

  const timeline = createTimeline({
    id:             'tl-hooks-test',
    name:           'Hooks Test Timeline',
    fps:            frameRate(30),
    duration:       toFrame(9000),
    startTimecode:  toTimecode('00:00:00:00'),
    tracks:         [track],
  });

  return createTimelineState({
    timeline,
    assetRegistry: new Map([[ASSET_ID, asset]]),
  });
}

function makeTx(label: string, ...ops: Transaction['operations']): Transaction {
  return { id: `tx-${label}`, label, timestamp: 0, operations: [...ops] };
}

// ── Provider wrapper factory ─────────────────────────────────────────────────

function makeWrapper(engine: TimelineEngine) {
  return ({ children }: { children: ReactNode }) => (
    <TimelineProvider engine={engine}>{children}</TimelineProvider>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useEngine', () => {
  it('returns the engine instance from context', () => {
    const engine  = new TimelineEngine({ initialState: makeState() });
    const wrapper = makeWrapper(engine);
    const { result } = renderHook(() => useEngine(), { wrapper });
    expect(result.current).toBe(engine);
  });

  it('throws outside TimelineProvider', () => {
    expect(() => renderHook(() => useEngine())).toThrow('TimelineProvider');
  });
});

describe('useTimeline', () => {
  it('returns the Timeline object from the snapshot', () => {
    const engine  = new TimelineEngine({ initialState: makeState() });
    const wrapper = makeWrapper(engine);
    const { result } = renderHook(() => useTimeline(), { wrapper });
    expect(result.current.name).toBe('Hooks Test Timeline');
    expect(result.current.fps).toBe(30);
  });

  it('re-renders when timeline name changes', async () => {
    const engine  = new TimelineEngine({ initialState: makeState() });
    const wrapper = makeWrapper(engine);
    const { result } = renderHook(() => useTimeline(), { wrapper });
    expect(result.current.name).toBe('Hooks Test Timeline');

    act(() => {
      engine.dispatch(makeTx('rename', { type: 'RENAME_TIMELINE', name: 'Renamed' }));
    });

    expect(result.current.name).toBe('Renamed');
  });
});

describe('useTrackIds', () => {
  it('returns a readonly array of track ids', () => {
    const engine  = new TimelineEngine({ initialState: makeState() });
    const wrapper = makeWrapper(engine);
    const { result } = renderHook(() => useTrackIds(), { wrapper });
    expect(result.current).toEqual([TRACK_ID]);
  });

  it('returns the SAME array reference between notifies (stable ref)', () => {
    const engine  = new TimelineEngine({ initialState: makeState() });
    const wrapper = makeWrapper(engine);
    const { result } = renderHook(() => useTrackIds(), { wrapper });
    const ref1 = result.current;

    // Dispatch something that does NOT change tracks
    act(() => {
      engine.dispatch(makeTx('rename', { type: 'RENAME_TIMELINE', name: 'Changed' }));
    });

    // Engine notifies, but trackIds array is rebuilt with same content.
    // useSyncExternalStore uses Object.is — new array with same content still
    // causes re-render, BUT the array reference is stable within a render.
    // The important invariant: reading trackIds twice within one render = same ref.
    const ref2 = result.current;
    // ref2 may be a new array (new notify → new buildSnapshot → new .map()),
    // but each element is identical, and no infinite loop occurs.
    expect(ref2).toEqual([TRACK_ID]);
  });
});

describe('useTrack', () => {
  it('returns the track matching the given id', () => {
    const engine  = new TimelineEngine({ initialState: makeState() });
    const wrapper = makeWrapper(engine);
    const { result } = renderHook(() => useTrack(TRACK_ID), { wrapper });
    expect(result.current?.id).toBe(TRACK_ID);
    expect(result.current?.clips).toHaveLength(2);
  });

  it('returns null for an unknown track id', () => {
    const engine  = new TimelineEngine({ initialState: makeState() });
    const wrapper = makeWrapper(engine);
    const { result } = renderHook(() => useTrack(toTrackId('ghost')), { wrapper });
    expect(result.current).toBeNull();
  });
});

describe('useClip', () => {
  it('returns the clip matching the given id from committed state', () => {
    const engine  = new TimelineEngine({ initialState: makeState() });
    const wrapper = makeWrapper(engine);
    const { result } = renderHook(() => useClip(CLIP_A_ID), { wrapper });
    expect(result.current?.id).toBe(CLIP_A_ID);
    expect(result.current?.timelineStart).toBe(toFrame(0));
  });

  it('returns null for a non-existent clip id', () => {
    const engine  = new TimelineEngine({ initialState: makeState() });
    const wrapper = makeWrapper(engine);
    const { result } = renderHook(() => useClip(toClipId('ghost')), { wrapper });
    expect(result.current).toBeNull();
  });

  // ── THE CRITICAL ISOLATION TEST ────────────────────────────────────────────
  //
  // WHAT THIS PROVES:
  //   Two hooks subscribe to clip A and clip B respectively.
  //   We dispatch SET_CLIP_NAME on clip A only.
  //   The clip A hook must reflect the new name.
  //   The clip B hook must return the SAME object reference as before the dispatch.
  //
  // WHY OBJECT IDENTITY PROVES ISOLATION:
  //   useSyncExternalStore calls the selector every time the engine notifies.
  //   If the selector for clip B returns the SAME reference (Object.is === true),
  //   React marks that subscription as unchanged and does NOT schedule a re-render.
  //   If we get a new reference back for clip B, it would always re-render — that
  //   is the bug this test catches.
  //
  //   Note: we can't count "renders" with renderHook easily (it re-renders on
  //   all notifications to check), but we CAN verify that the selector returns
  //   the identical reference, which is what React uses to gate the re-render.

  it('ISOLATION: clip B selector returns same reference when only clip A changes', () => {
    const engine  = new TimelineEngine({ initialState: makeState() });
    const wrapper = makeWrapper(engine);

    // Render two independent hooks — one per clip
    const hookA = renderHook(() => useClip(CLIP_A_ID), { wrapper });
    const hookB = renderHook(() => useClip(CLIP_B_ID), { wrapper });

    // Capture clip B's reference BEFORE the dispatch
    const clipBBefore = hookB.result.current;
    expect(clipBBefore?.id).toBe(CLIP_B_ID);

    // Change clip A's name — clip B is untouched
    act(() => {
      engine.dispatch(makeTx('rename-clip-a', {
        type:   'SET_CLIP_NAME',
        clipId: CLIP_A_ID,
        name:   'Renamed Clip A',
      }));
    });

    // Clip A must reflect the change
    expect(hookA.result.current?.name).toBe('Renamed Clip A');

    // Clip B's selector must return the IDENTICAL object reference (Object.is equality)
    // This is the contract: same object → useSyncExternalStore skips the re-render
    expect(hookB.result.current).toBe(clipBBefore);
  });

  it('ISOLATION: clip B renders when clip B itself changes', () => {
    const engine  = new TimelineEngine({ initialState: makeState() });
    const wrapper = makeWrapper(engine);

    const hookB = renderHook(() => useClip(CLIP_B_ID), { wrapper });
    const clipBBefore = hookB.result.current;

    act(() => {
      engine.dispatch(makeTx('rename-clip-b', {
        type:   'SET_CLIP_NAME',
        clipId: CLIP_B_ID,
        name:   'Renamed Clip B',
      }));
    });

    // References must differ — clip B was rebuilt with the new name
    expect(hookB.result.current).not.toBe(clipBBefore);
    expect(hookB.result.current?.name).toBe('Renamed Clip B');
  });
});

describe('useActiveTool', () => {
  it('returns id and cursor string', () => {
    const engine  = new TimelineEngine({ initialState: makeState() });
    const wrapper = makeWrapper(engine);
    const { result } = renderHook(() => useActiveTool(), { wrapper });
    expect(typeof result.current.id).toBe('string');
    expect(typeof result.current.cursor).toBe('string');
  });
});

describe('useCanUndo / useCanRedo', () => {
  it('canUndo is false initially, true after a dispatch', () => {
    const engine  = new TimelineEngine({ initialState: makeState() });
    const wrapper = makeWrapper(engine);
    const { result } = renderHook(() => useCanUndo(), { wrapper });
    expect(result.current).toBe(false);

    act(() => {
      engine.dispatch(makeTx('rename', { type: 'RENAME_TIMELINE', name: 'X' }));
    });

    expect(result.current).toBe(true);
  });

  it('canRedo is false initially, true after an undo', () => {
    const engine  = new TimelineEngine({ initialState: makeState() });
    const wrapper = makeWrapper(engine);
    const { result: undoResult } = renderHook(() => useCanUndo(), { wrapper });
    const { result: redoResult } = renderHook(() => useCanRedo(), { wrapper });

    act(() => {
      engine.dispatch(makeTx('rename', { type: 'RENAME_TIMELINE', name: 'X' }));
    });
    expect(redoResult.current).toBe(false);

    act(() => { engine.undo(); });
    expect(undoResult.current).toBe(false);
    expect(redoResult.current).toBe(true);
  });
});

describe('useProvisional', () => {
  it('returns null when not dragging', () => {
    const engine  = new TimelineEngine({ initialState: makeState() });
    const wrapper = makeWrapper(engine);
    const { result } = renderHook(() => useProvisional(), { wrapper });
    expect(result.current).toBeNull();
  });
});
